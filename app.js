require('dotenv').config();

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const axios = require('axios');
const cheerio = require('cheerio');
const { admin, db } = require('./firebase'); // Import Firestore and admin instance
const methodOverride = require('method-override');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID
const RSS_FEED_URL = process.env.RSS_FEED_URL

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI(process.env.OPENAI_API_KEY);
app.use(methodOverride('_method')); // Set up method override


// Set the view engine to ejs
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images) from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', async (req, res) => {
    const usersList = [];
    try {
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
            usersList.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error fetching users from Firestore:', error);
        return res.status(500).send('Internal Server Error');
    }

    const host = req.get('host'); // Get the current host

    res.render('dashboard', { usersList, host });
});

async function pollVectorStoreStatus(vectorStoreId) {
    let isComplete = false;
    do {
        const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
        if (vectorStore.file_counts.in_progress === 0 && vectorStore.file_counts.failed === 0) {
            isComplete = true;
        } else {
            console.log('Waiting for vector store processing to complete...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 30 seconds
        }
    } while (!isComplete);
    console.log('Vector Store processing completed.');
}

app.post('/users', upload.array('assistantFiles'), async (req, res) => {
    req.body.fileRetrieval = req.body.fileRetrieval === 'on';
    req.body.codeInterpreter = req.body.codeInterpreter === 'on';

    const username = req.body.username;
    const rss = req.body.rss;

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    // Upload files to OpenAI
    const fileIds = [];
    vectorStoreId = [];
    if (req.files) {
        for (const file of req.files) {
            const tempFilePath = path.join(tempDir, file.originalname);
            await fs.promises.copyFile(file.path, tempFilePath);

            try {
                const openaiFile = await openai.files.create({
                    file: fs.createReadStream(tempFilePath),
                    purpose: 'assistants',
                });
                console.log(openaiFile);
                fileIds.push(openaiFile.id);
            } catch (e) {
                console.log(e);
            }

            // Clean up the temporary file
            await fs.promises.unlink(tempFilePath);
        }
        if (fileIds.length > 0) {
            const vectorStore = await openai.beta.vectorStores.create({
                name: `${username} Chat Files`,
                file_ids: fileIds,
                expires_after: {
                    anchor: "last_active_at",
                    days: 7
                }
            });
        
            console.log('Vector Store initiated:', vectorStore);
        
            await pollVectorStoreStatus(vectorStore.id);
            vectorStoreId = [vectorStore.id];
        }
    }


    let myAssistant;
    console.log(req.body);
    console.log(req.body.assistantName);

    const assistantParams = JSON.parse(fs.readFileSync('assistant_params.json', 'utf-8'));

    if (req.body.fileRetrieval && req.body.codeInterpreter) {
        myAssistant = await openai.beta.assistants.create({
            instructions: req.body.assistantInstructions,
            name: req.body.assistantName,
            tools: [{ type: "code_interpreter" }, { type: "file_search" }, ...assistantParams.tools],
            model: req.body.model,
            tool_resources: {
                "file_search": {
                  "vector_store_ids": vectorStoreId
                }
              }
        });
    } else if (!req.body.fileRetrieval && req.body.codeInterpreter) {
        myAssistant = await openai.beta.assistants.create({
            instructions: req.body.assistantInstructions,
            name: req.body.assistantName,
            tools: [{ type: "code_interpreter" }, ...assistantParams.tools],
            model: req.body.model,
            tool_resources: {
                "file_search": {
                  "vector_store_ids": vectorStoreId
                }
              }
        });
    } else if (req.body.fileRetrieval && !req.body.codeInterpreter) {
        myAssistant = await openai.beta.assistants.create({
            instructions: req.body.assistantInstructions,
            name: req.body.assistantName,
            tools: [{ type: "file_search" }, ...assistantParams.tools],
            model: req.body.model,
            tool_resources: {
                "file_search": {
                  "vector_store_ids": vectorStoreId
                }
              }
        });
    } else {
        myAssistant = await openai.beta.assistants.create({
            instructions: req.body.assistantInstructions,
            name: req.body.assistantName,
            tools: [...assistantParams.tools],
            model: req.body.model,
            tool_resources: {
                "file_search": {
                  "vector_store_ids": vectorStoreId
                }
              }
        });
    }
    console.log(myAssistant);

    console.log("assistant id: ", myAssistant.id);

    // Save data to Firestore
    const userData = {
        username: username,
        rss: rss,
        assistant: {
            instructions: req.body.assistantInstructions,
            name: req.body.assistantName,
            tools: myAssistant.tools,
            model: req.body.model,
            id: myAssistant.id
        },
        fileIds: fileIds,
        fileRetrieval: req.body.fileRetrieval,
        codeInterpreter: req.body.codeInterpreter
    };

    try {
        await db.collection('users').add(userData);
        res.redirect('/');
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Delete user route
app.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;

    console.log(userId);

    try {
        await db.collection('users').doc(userId).delete();
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting user from Firestore:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/chat/:username', async (req, res) => {
    const username = req.params.username;

    try {
        const userSnapshot = await db.collection('users').where('username', '==', username).get();
        
        if (userSnapshot.empty) {
            console.log('No matching docunts.');
            return res.status(404).send('User not found');
        }

        let userData;
        userSnapshot.forEach(doc => {
            userData = doc.data();
        });

        console.log(userData);

        res.render('chat', {
            username: userData.username,
            rss: userData.rss,
            assistantId: userData.assistant.id
        });
    } catch (error) {
        console.error('Error retrieving user from Firestore:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/create-thread', async (req, res) => {
    console.log("thread creation...");
    try {
        const thread = await openai.beta.threads.create();
        console.log(thread.id)
        res.json({ threadId: thread.id });
    } catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).send('An error occurred while creating the thread');
    }
});

// Function to get RSS feed titles and URLs
async function get_rss_feed_titles_and_urls(url) {
    try {
        const response = await axios.get(url);
        const feedContent = response.data;

        const items = feedContent.items || [];
        const result = items
            .filter(item => item.title && item.url)
            .map(item => ({ title: item.title, url: item.url }));

        return JSON.stringify(result, null, 4);
    } catch (error) {
        if (error.response) {
            return JSON.stringify({ error: `Error fetching the RSS feed: ${error.message}` });
        } else if (error.request) {
            return JSON.stringify({ error: `No response received: ${error.message}` });
        } else {
            return JSON.stringify({ error: `Error: ${error.message}` });
        }
    }
}

async function extract_article_content(url) {
    try {
        const response = await axios.get(url);

        // Load the HTML content using cheerio
        const $ = cheerio.load(response.data);

        // Extract the content within paragraph tags
        const paragraphs = $('p').map((i, el) => $(el).text()).get();
        const content = paragraphs.join('\n');

        return content;
    } catch (error) {
        if (error.response) {
            return `Error fetching the article: ${error.message}`;
        } else if (error.request) {
            return `No response received: ${error.message}`;
        } else {
            return `Error extracting the article content: ${error.message}`;
        }
    }
}


app.post('/text-message', async (req, res) => {
    console.log("text");
    console.log(req.body);
    const threadId = req.body.threadId;
    const userMessage = req.body.userMessage;
    const assistantId = req.body.assistantId;
    const rss = req.body.rss;
    const username = req.body.username;
    try {
        // Generate chatbot response
        const responseText = await generateResponse(userMessage, threadId, assistantId, rss, username);

        // Convert response text to audio
        const speech = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: responseText,
        });

        const buffer = Buffer.from(await speech.arrayBuffer());
        const responseAudioFilename = `response-${Date.now()}.mp3`;
        const responseAudioPath = path.join(__dirname, '/public/uploads', responseAudioFilename);
        fs.writeFileSync(responseAudioPath, buffer);

        // Send the text response and audio file URL
        res.json({
            responseText: responseText,
            audioUrl: `/uploads/${responseAudioFilename}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});

function removeSpecialCharacters(text) {
    return text.replace(/[*#]/g, '');
}


app.post('/voice-message', upload.single('audio'), async (req, res) => {
    console.log(req.body);
    const threadId = req.body.threadId; 
    const assistantId = req.body.assistantId;
    const username = req.body.username;
    const rss = req.body.rss;
    console.log('voice...', assistantId);
    try {
        //  audio to mp3 format
        const mp3FilePath = path.join(__dirname, 'uploads', `${req.file.filename}.mp3`);
        await new Promise((resolve, reject) => {
            ffmpeg(req.file.path)
                .toFormat('mp3')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(mp3FilePath);
        });

        // Transcribe audio to text
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(mp3FilePath),
            model: "whisper-1",
            language: "en"
        });

        console.log(transcription.text);

        // Generate chatbot response
        const responseText = await generateResponse(transcription.text, threadId, assistantId, rss, username);

        // Remove * and # characters from the response text
        responseTextFormated = removeSpecialCharacters(responseText);

        // Convert response text to audio
        const speech = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: responseTextFormated,
        });

        const buffer = Buffer.from(await speech.arrayBuffer());
        const responseAudioFilename = `response-${Date.now()}.mp3`;
        const responseAudioPath = path.join(__dirname, '/public/uploads', responseAudioFilename);
        fs.writeFileSync(responseAudioPath, buffer);

        // Send the text response and audio file URL
        res.json({
            responseText: responseText,
            audioUrl: `/uploads/${responseAudioFilename}`
        });

        // Delete the uploaded and converted audio files
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting uploaded file:", err);
        });
        fs.unlink(mp3FilePath, (err) => {
            if (err) console.error("Error deleting converted file:", err);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});


async function generateResponse(userMessage, thread_id, assistantId, rss, username) {
    console.log('generating response...', assistantId);
    const message = await openai.beta.threads.messages.create(
        thread_id,
        {
            role: "user",
            content: userMessage,
        }
    );
    const run = await openai.beta.threads.runs.create(
        thread_id,
        {
            assistant_id: assistantId,
        }
    );
    const checkStatusAndPrintMessages = async (threadId, runId) => {
        let runStatus;
        let success = true;
        while (true) {
            runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            if (runStatus.status === "completed") {
                console.log(runStatus.status);
                break; // Exit the loop if the run status is completed
            } else if (runStatus.status === "failed") {
                console.log(runStatus);
                success = false;
                break;
            } else if (runStatus.status === 'requires_action') {

                const requiredActions = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(requiredActions);

                let toolsOutput = [];

                for (const action of requiredActions) {
                    const funcName = action.function.name;
                    const functionArguments = JSON.parse(action.function.arguments);

                    console.log(functionArguments);

                    if (funcName === "get_rss_feed_titles_and_urls") {
                        console.log("get_rss_feed_titles_and_urls");
                        const output = await get_rss_feed_titles_and_urls(rss);
                        console.log(output);
                        toolsOutput.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(output)
                        });
                    } else if (funcName === "extract_article_content") {
                        console.log("extract_article_content");
                        const output = await extract_article_content(...Object.values(functionArguments));
                        console.log(output);
                        toolsOutput.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(output)
                        });
                    }  else {
                        console.log("Function not found");
                    }
                }

                // Submit the tool outputs to Assistant API
                await openai.beta.threads.runs.submitToolOutputs(
                    thread_id,
                    run.id,
                    { tool_outputs: toolsOutput }
                );
            }
            console.log(runStatus.status);
            await delay(1000); // Wait for 1 second before checking again
        }
        if (success) {
            let messages = await openai.beta.threads.messages.list(threadId);
            console.log(messages.data[0].content[0].text.value)
            return messages.data[0].content[0].text.value
        } else {
            return "there is an issue generating the response"
        }
    };

    function delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    // Call checkStatusAndPrintMessages function
    const response = await checkStatusAndPrintMessages(thread_id, run.id);

    // Save the chat history to Firestore
    await saveChatHistory(username, userMessage, response);

    return response;
}

async function saveChatHistory(username, userMessage, aiResponse) {
    console.log('saving...');
    const chatRef = db.collection('chatHistory').doc(username);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
        // Create a new document if it doesn't exist
        await chatRef.set({
            history: [{ role: 'user', message: userMessage }, { role: 'assistant', message: aiResponse }]
        });
    } else {
        // Update the existing document
        await chatRef.update({
            history: admin.firestore.FieldValue.arrayUnion(
                { role: 'user', message: userMessage },
                { role: 'assistant', message: aiResponse }
            )
        });
    }
}


const port = 3000;


app.listen(port, () => {
    console.log('Server running on port 3000');
});
