const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input button");
const sendChatBtn = document.querySelector(".chat-input span");

let userAudio = null; // Variable to store user's message
let THREAD = "";

const inputInitHeight = chatInput.scrollHeight;
  
const createChatLi = (message, className) => {
    // Create a chat <li> element with passed message and className
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);
    
    let chatContent = className === "outgoing" ? `
        <div class="user message-container">
            <div class="message-info">
                <div class="user-name"><h5>You</h5></div>
                <div class="message-text">
                    <div class="chat-response">
                        <audio controls>
                            <source src="MUST BE userAudio" type="">
                        </audio>
                    </div>
                </div>
            </div>
        </div>
        <img src="./user.png" alt="">
    ` : `
    <img src="./profile.webp" alt="">
    <div class="message-container">
        <div class="message-info">
            <div class="user-name"><h5>Jarvis</h5></div>
            <div class="message-text">
                <div class="chat-response">${message}</div>
            </div>
        </div>
    </div>
`;
    chatLi.innerHTML = chatContent;
    return chatLi; // return chat <li> element
}


const makeRequest = (chatElement, thread, userAudio) => {

};


const generateResponse = (chatElement) => {
    if (THREAD == "") {
        // Adjusted to point to the WordPress PHP endpoint for creating a thread
        const THREAD_API_URL = "/wp-json/your-plugin/v1/create-thread";
        

        // Define the properties for the API request
        // Note: Authorization header is not needed here as authentication should be handled server-side
        const threadRequestOptions = { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({}) // Assuming the PHP endpoint does not require any specific body content
        };

        // Send POST request to the WordPress endpoint
        fetch(THREAD_API_URL, threadRequestOptions)
            .then(res => res.json())
            .then(data => {
                // Assuming 'data' includes the thread ID in a property named 'id'
                THREAD = data.id; // Store the thread ID for subsequent requests
                makeRequest(chatElement, THREAD, userAudio); // Continue to make the request using the thread ID
            })
            .catch((e) => {
                // Handle errors
                console.error("Error creating thread:", e);
            });
    } else {
        makeRequest(chatElement, THREAD, userAudio); // If the thread already exists, proceed with making the request
    }
}



const handleChat = () => {
    userAudio = chatInput.value.trim(); // Get user entered message and remove extra whitespace
    if(!userAudio) return;

    // Clear the input textarea and set its height to default
    chatInput.value = "";
    chatInput.style.height = `${inputInitHeight}px`;

    // Append the user's message to the chatbox
    chatbox.appendChild(createChatLi(userAudio, "outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);
    
    setTimeout(() => {
        // Display "Thinking..." message while waiting for the response
        const incomingChatLi = createChatLi("Thinking...", "incoming");
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        generateResponse(incomingChatLi);
    }, 600);
}

chatInput.addEventListener("input", () => {
    // Adjust the height of the input textarea based on its content
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener("keydown", (e) => {
    // If Enter key is pressed without Shift key and the window 
    // width is greater than 800px, handle the chat
    if(e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
        e.preventDefault();
        handleChat();
    }
});

sendChatBtn.addEventListener("click", handleChat);

const recordBtn = document.querySelector(".record");

let recording = false;

recordBtn.addEventListener("click", () => {
  if (!recording) {
    recordBtn.classList.add("recording");
    recordBtn.querySelector("p").innerHTML = "Listening...";
    recording = true;
  } else {
    stopRecording();
  }
});

function stopRecording() {
  recordBtn.querySelector("p").innerHTML = "Start Listening";
  recordBtn.classList.remove("recording");
  recording = false;
}

