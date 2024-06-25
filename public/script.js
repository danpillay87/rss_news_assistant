const recordBtn = document.querySelector(".record");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input");
let recording = false;
let mediaRecorder;
let userAudioBlob;
let userMessage = null; // Variable to store user's message
let THREAD = "";
let textResponse = null;

recordBtn.addEventListener("click", () => {
    if (!recording) {
        startRecording();
        chatInput.classList.add('listening');
    } else {
        stopRecording();
        chatInput.classList.remove('listening');
    }
});

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            mediaRecorder.start();

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                userAudioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
                displayUserMessage(URL.createObjectURL(userAudioBlob));
            });

            recordBtn.classList.add("recording");
            // recordBtn.querySelector("p").innerHTML = "Listening...";
            recording = true;
        });
}
function convertTextForDisplay(text) {
    // Replace text wrapped with ** to bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace newline characters with <br> tags
    text = text.replace(/\n/g, '<br>');
    // Convert Markdown links to HTML links that open in a new window
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s]+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Convert text after any #, ##, or ### to bold and remove the #
    text = text.replace(/#+\s*(.*?)\n/g, '<strong>$1</strong>\n');
    return text;
}

function stopRecording() {
    mediaRecorder.stop();
    // recordBtn.querySelector("p").innerHTML = "Start Speaking";
    recordBtn.classList.remove("recording");
    recording = false;
}

function sendVoiceMessage(chatElement) {
    const formData = new FormData();
    formData.append("audio", userAudioBlob, "userAudio.mp3");

    if (THREAD == "") {
        fetch('/create-thread')
            .then(response => response.json())
            .then(data => {
                const threadId = data.threadId;
                THREAD = threadId;
                formData.append("threadId", THREAD);
                return fetch("/voice-message", {
                    method: "POST",
                    body: formData,
                });
            })
            .then(response => response.json())
            .then(data => {
                textResponse = data.responseText; // Log the text response
                return fetch(data.audioUrl); // Fetch the audio file using the provided URL
            })
            .then(response => response.blob())
            .then(blob => {
                displayBotMessage(chatElement, URL.createObjectURL(blob), textResponse); // Display the audio message
            })
            .catch(error => {
                console.error("Error sending voice message:", error);
            });
    } else {
        formData.append("threadId", THREAD);
        fetch("/voice-message", {
            method: "POST",
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                textResponse = data.responseText; // Log the text response
                return fetch(data.audioUrl); // Fetch the audio file using the provided URL
            })
            .then(response => response.blob())
            .then(blob => {
                displayBotMessage(chatElement, URL.createObjectURL(blob), textResponse); // Display the audio message
            })
            .catch(error => {
                console.error("Error sending voice message:", error);
            });
    }
}



function displayUserMessage(audioUrl) {
    const chatLi = createChatLi(audioUrl, "outgoing");
    chatbox.appendChild(chatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
    const incomingChatLi = createThinkingChatLi();
    chatbox.appendChild(incomingChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
    sendVoiceMessage(incomingChatLi);
}

function displayBotMessage(chatElement, audioUrl, textResponse) {
    const chatLi = createChatLi(audioUrl, "incoming", textResponse);
    chatElement.replaceWith(chatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);

    // Find the audio element in the newly added chatLi and play it
    const audioElement = chatLi.querySelector("audio");
    if (audioElement) {
        audioElement.play();
    }
}

function createChatLi(audioUrl, className, textResponse) {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);
    let chatContent;
    if (className === "outgoing") {
        chatContent = `
            <div class="user message-container none">
                <div class="message-info">
                    <div class="user-name"><h5>You</h5></div>
                    <div class="message-text">
                        <div class="chat-response">
                            <audio controls>
                                <source src="${audioUrl}" type="audio/mp3">
                            </audio>
                        </div>
                    </div>
                </div>
            </div>
            <img src="./user.png" alt="">
        `;
    } else {
        chatContent = `
            <img src="./profile.webp" alt="">
            <div class="message-container">
                <div class="message-info">
                    <div class="user-name"><h5>Jarvis</h5></div>
                    <div class="message-text">
                        <div class="chat-response">
                        ${convertTextForDisplay(textResponse)}
                            <audio controls style="display: none;">
                                <source src="${audioUrl}" type="audio/mp3">
                            </audio>
                        </div>
                        <div class="message-audio">
                            <span class="material-symbols-outlined play-audio audio-icon hide">
                                volume_up
                            </span>
                            <span class="material-symbols-outlined audio-icon stop-audio">
                                stop_circle
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    chatLi.innerHTML = chatContent;
    return chatLi;
}
function createThinkingChatLi() {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `incoming`);
    let chatContent;
    chatContent = `
    <img src="./profile.webp" alt="">
            <div class="user message-container none">
                <div class="message-info">
                    <div class="user-name"><h5>Jarvis</h5></div>
                    <div class="message-text">
                        <div class="chat-response">Thinking...</div>
                      </div>
                </div>
            </div>
        `;
    chatLi.innerHTML = chatContent;
    return chatLi;
}


const sendBtn = document.querySelector("#send-btn"); // Add a selector for the send button
const textBox = document.querySelector(".textBox"); // Add a selector for the send button

// Function to handle sending text messages
function displayUserTextMessage() {
    console.log('cccccccccccccccccc');
    userMessage = textBox.value.trim(); // Get the message from the textarea
    const chatLi = createTextChatLi(userMessage, "outgoing");
    chatbox.appendChild(chatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
    const incomingChatLi = createThinkingChatLi();
    chatbox.appendChild(incomingChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
    textBox.value = "";
    sendTextMessage(incomingChatLi);
}
const createTextChatLi = (message, className) => {
    // Create a chat <li> element with passed message and className
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);

    let chatContent = className === "outgoing" ? `
        <div class="user message-container none">
            <div class="message-info">
                <div class="user-name"><h5>You</h5></div>
                <div class="message-text">
                    <div class="chat-response">${message}</div>
                </div>
            </div>
        </div>
        <img src="./user.png" alt="">
    ` : `
    <img src="./profile.png" alt="">
    <div class="message-container">
        <div class="message-info">
            <div class="user-name"><h5>AI Interviewer</h5></div>
            <div class="message-text">
                <div class="chat-response">${convertTextForDisplay(message)}</div>
                <div class="message-audio">
                            <span class="material-symbols-outlined audio-icon play-audio hide">
                                volume_up
                            </span>
                            <span class="material-symbols-outlined audio-icon stop-audio">
                                stop_circle
                            </span>
                        </div>
            </div>
        </div>
    </div>
`;
    chatLi.innerHTML = chatContent;
    return chatLi; // return chat <li> element
}
function sendTextMessage(chatElement) {
    const messageData = {
        userMessage: userMessage,
        threadId: THREAD
    };

    if (userMessage) {
        if (THREAD == "") {
            fetch('/create-thread')
                .then(response => response.json())
                .then(data => {
                    const threadId = data.threadId;
                    THREAD = threadId;
                    messageData.threadId = THREAD;
                    return fetch("/text-message", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(messageData),
                    });
                })
                .then(response => response.json())
                .then(data => {
                    textResponse = data.responseText; // Log the text response
                    return fetch(data.audioUrl); // Fetch the audio file using the provided URL
                })
                .then(response => response.blob())
                .then(blob => {
                    displayBotMessage(chatElement, URL.createObjectURL(blob), textResponse); // Display the audio message
                })
                .catch(error => {
                    console.error("Error sending text message:", error);
                });
        } else {
            fetch("/text-message", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageData),
            })
                .then(response => response.json())
                .then(data => {
                    textResponse = data.responseText; // Log the text response
                    return fetch(data.audioUrl); // Fetch the audio file using the provided URL
                })
                .then(response => response.blob())
                .then(blob => {
                    displayBotMessage(chatElement, URL.createObjectURL(blob), textResponse); // Display the audio message
                })
                .catch(error => {
                    console.error("Error sending text message:", error);
                });
        }
    }
}



// Event listener for the send button
sendBtn.addEventListener("click", displayUserTextMessage);

// Event listener for the chat input to handle Enter key press
chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent the default action of the Enter key
        displayUserTextMessage();
    }
});


document.addEventListener('DOMContentLoaded', function() {
    // Add an event listener to the entire document
    document.addEventListener('click', function(event) {
        // Check if the clicked element is a play or stop audio icon
        if (event.target.classList.contains('play-audio') || event.target.classList.contains('stop-audio')) {
            var icon = event.target;
            // Find the closest message container and the audio element within it
            var messageContainer = icon.closest('.message-container');
            var audio = messageContainer.querySelector('audio');

            // Play or stop the audio based on the icon clicked
            if (icon.classList.contains('play-audio')) {
                // Play the audio
                audio.play();
                // Hide the play icon and show the stop icon
                icon.classList.add('hide');
                messageContainer.querySelector('.stop-audio').classList.remove('hide');
            } else {
                // Stop the audio
                audio.pause();
                audio.currentTime = 0;
                // Hide the stop icon and show the play icon
                icon.classList.add('hide');
                messageContainer.querySelector('.play-audio').classList.remove('hide');
            }
        }
    });

    // Add event listener to handle audio ending for dynamically added audio elements
    document.addEventListener('ended', function(event) {
        if (event.target.tagName === 'AUDIO') {
            // Find the closest message container and the stop icon within it
            var messageContainer = event.target.closest('.message-container');
            var stopIcon = messageContainer.querySelector('.stop-audio');
            // Hide the stop icon and show the play icon
            stopIcon.classList.add('hide');
            messageContainer.querySelector('.play-audio').classList.remove('hide');
        }
    }, true);
});
