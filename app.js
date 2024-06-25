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

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID
const RSS_FEED_URL = process.env.RSS_FEED_URL

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images) from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.render('chat');
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
    const threadId = req.body.threadId;
    const userMessage = req.body.userMessage;
    try {
        // Generate chatbot response
        const responseText = await generateResponse(userMessage, threadId);

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
    const threadId = req.body.threadId;
    try {
        // Convert audio to mp3 format
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
        const responseText = await generateResponse(transcription.text, threadId);

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


async function generateResponse(userMessage, thread_id) {
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
            assistant_id: ASSISTANT_ID,
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
                        const output = await get_rss_feed_titles_and_urls(RSS_FEED_URL);
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
    return response;
}
const port = 3000;


app.listen(port, () => {
    console.log('Server running on port 3000');
});
