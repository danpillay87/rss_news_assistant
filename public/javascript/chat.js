const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span.send");

// ***************** Base Url *****************
const baseUrl = window.location.origin;

window.addEventListener('load', function() {
    sessionStorage.clear();
});

let userMessage = null; // Variable to store user's message
let files = [];
const inputInitHeight = chatInput.scrollHeight;

const createChatLi = (message, className) => {
    // Create a chat <li> element with passed message and className
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);
    const image = document.querySelector('.imgurl');
    const imageUrl = image.getAttribute('data-botimage');
    let name = document.querySelector(".user-name");
    let chatContent = className === "outgoing" ? `
        <div class="user message-container">
            <div class="message-info">
                <div class="user-name"><h5>You</h5></div>
                <div class="message-text">
                    <div class="chat-response">${message}</div>
                </div>
            </div>
        </div>
        <img src="../../images/user.png" alt="">
    ` : `
    <img src="${imageUrl}" alt="">
    <div class="message-container">
        <div class="message-info">
            <div class="user-name"><h5>${name.textContent}</h5></div>
            <div class="message-text">
                <div class="chat-response">${message}</div>
            </div>
        </div>
    </div>
`;
    chatLi.innerHTML = chatContent;
    return chatLi;
};


const makeAssistantRequest = (chatElement, thread) => {
    const assistantDiv = document.querySelector('#inf');
    const assistantId = assistantDiv.getAttribute('data-assistantid');
    const id = assistantDiv.getAttribute('data-id');

    // Create FormData
    const formData = new FormData();
    formData.append('thread', thread);
    formData.append('userMessage', userMessage);
    formData.append('id', id);
    formData.append('assistantId', assistantId);

    // Append files to FormData if any
    files.forEach((file) => {
        formData.append('assistantFiles', file);
    });

    fetch(`${baseUrl}/get-assistant-response`, {
        method: 'POST',
        body: formData // FormData will be sent as multipart/form-data
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.json();
    }).then(data => {
        const messageElement = chatElement.querySelector(".chat-response");
        messageElement.textContent = data.response;
        chatbox.scrollTo(0, chatbox.scrollHeight);

        // Clear the files array after successful upload
        files = [];
    }).catch(error => {
        console.error('There was a problem with your fetch operation:', error);
    });
}
const makeChatRequest = (chatElement) => {
    const chatDiv = document.querySelector('#inf');
    const prompt = chatDiv.getAttribute('data-prompt');
    const model = chatDiv.getAttribute('data-model');
    const id = chatDiv.getAttribute('data-id');

    const requestData = {
        model,
        userMessage: userMessage,
        prompt,
        id
    };

    fetch(`${baseUrl}/get-chat-response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.json();
    }).then(data => {
        const messageElement = chatElement.querySelector(".chat-response");
        messageElement.textContent = data.response;
        chatbox.scrollTo(0, chatbox.scrollHeight);
    }).catch(error => {
        console.error('There was a problem with your fetch operation:', error);
    });
}

const generateAssistantResponse = async (chatElement) => {
    if (!sessionStorage.getItem("thread_id")) {
        await fetch(`${baseUrl}/create-thread`)
            .then((response) => response.json())
            .then((data) => {
                sessionStorage.setItem("thread_id", data.thread);
                makeAssistantRequest(chatElement, sessionStorage.getItem("thread_id"));
            })
            .catch((e) => {
                // Handle errors
                console.error(e);
            });
    } else {
        thread_id = sessionStorage.getItem("thread_id");
        makeAssistantRequest(chatElement, sessionStorage.getItem("thread_id"));
    }
}

// ======== file upload ==============
let fileInput = document.getElementById("additionalFiles");
let fileList = document.getElementById("files-list");
let numOfFiles = document.querySelector(".num-of-files");

fileInput.addEventListener("change", () => {
    fileList.innerHTML = "";
    numOfFiles.classList.add("show");
    if (fileInput.files.length == 0) {
        numOfFiles.textContent = `No Files Chosen`;
    } else {
        numOfFiles.textContent = `File Selected`;
    }
});

const handleChat = () => {
    userMessage = chatInput.value.trim(); // Get user entered message and remove extra whitespace
    numOfFiles.classList.remove("show");
    if (!userMessage) return;

    if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            files.push(fileInput.files[i]);
        }
    }

    // Clear the input textarea and set its height to default
    chatInput.value = "";
    chatInput.style.height = `${inputInitHeight}px`;

    // Append the user's message to the chatbox
    chatbox.appendChild(createChatLi(userMessage, "outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);

    setTimeout(() => {
        // Display "Thinking..." message while waiting for the response
        const incomingChatLi = createChatLi("Thinking...", "incoming");
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        const isAssistantDiv = document.querySelector('#inf');
        const isAssistant = isAssistantDiv.getAttribute('data-assistant');
        if (isAssistant == "true") {
            generateAssistantResponse(incomingChatLi);
        } else {
            makeChatRequest(incomingChatLi);
        }
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
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
        e.preventDefault();
        handleChat();
    }
});

sendChatBtn.addEventListener("click", handleChat);