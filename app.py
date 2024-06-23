import os
import openai
import time
import streamlit as st
from dotenv import load_dotenv
import time
import requests
import json
from bs4 import BeautifulSoup

# Load environment variables from .env file
load_dotenv()

# Set OpenAI API key
openai.api_key = st.secrets["OPENAI_API_KEY"]

# Create a client instance
client = openai.Client()

# main assistant
mainAssistant = st.secrets["ASSISTANT_ID"]
rss_feed_url = st.secrets["RSS_FEED_URL"]

def get_rss_feed_titles_and_urls(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        feed_content = response.json()

        items = feed_content.get("items", [])
        result = [{"title": item.get("title"), "url": item.get("url")} for item in items if item.get("title") and item.get("url")]

        return json.dumps(result, indent=4)
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"Error fetching the RSS feed: {e}"})
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Error decoding the JSON content: {e}"})

def extract_article_content(url):
    try:
        response = requests.get(url)
        response.raise_for_status()

        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(response.content, 'html.parser')

        # Extract the content within paragraph tags
        paragraphs = soup.find_all('p')
        content = "\n".join(paragraph.get_text() for paragraph in paragraphs)

        return content
    except requests.exceptions.RequestException as e:
        return f"Error fetching the article: {e}"
    except Exception as e:
        return f"Error extracting the article content: {e}"

def getAssistantResponse(assistant_id):
    print(assistant_id)
    # Check if 'messages' key is not in session_state
    if "messages" not in st.session_state:
    # If not present, initialize 'messages' as an empty list
        st.session_state.messages = []
    # Iterate through messages in session_state
    for message in st.session_state.messages:
    # Display message content in the chat UI based on the role
        with st.chat_message(message["role"]):
            st.markdown(message["content"])    
    # Get user input from chat and proceed if a prompt is entered
    if prompt := st.chat_input("Enter your message here"):
        # Add user input as a message to session_state
        st.session_state.messages.append({"role": "user", "content": prompt})
        # Display user's message in the chat UI
        with st.chat_message("user"):
            st.markdown(prompt)
        # Process the assistant's response
        with st.spinner("Thinking..."):
            getAssistantRetriavalResponse(assistant_id, prompt)

def getAssistantRetriavalResponse(assistant_id, prompt):
    if "thread_file_id" not in st.session_state:
        thread = client.beta.threads.create()
        st.session_state.thread_file_id = thread.id
    thread_file_id = st.session_state.thread_file_id

    message = client.beta.threads.messages.create(
        thread_id=thread_file_id,
        role="user",
        content= prompt,
    )

    run = client.beta.threads.runs.create(
        thread_id=thread_file_id,
        assistant_id=assistant_id,
        )

    while True:  # Change to an infinite loop to continually check for completion
        run = client.beta.threads.runs.retrieve(
            thread_id=thread_file_id,
            run_id=run.id
        )
        print(run.status)
        if run.status == "completed":
            break  # Exit the loop once the run is completed
        elif run.status == "failed":
            print(run)
        elif run.status == 'requires_action':
            required_actions = run.required_action.submit_tool_outputs.model_dump()
            tool_outputs = []
            import json
            for action in required_actions["tool_calls"]:
                func_name = action['function']['name']
                arguments = json.loads(action['function']['arguments'])
                print(func_name)
                print(arguments)

                if func_name == "get_rss_feed_titles_and_urls":
                    output = get_rss_feed_titles_and_urls(rss_feed_url)
                    print(output)
                    tool_outputs.append({
                        "tool_call_id": action['id'],
                        "output": output
                    })
                elif func_name == "extract_article_content":
                    output = extract_article_content(arguments['article_url'])
                    print(output)
                    tool_outputs.append({
                        "tool_call_id": action['id'],
                        "output": output
                    })
                else:
                    raise ValueError(f"Unknown function: {func_name}")

            client.beta.threads.runs.submit_tool_outputs(
                thread_id=thread_file_id,
                run_id=run.id,
                tool_outputs=tool_outputs
            )
        else:
            time.sleep(0.5)

    messages = client.beta.threads.messages.list(
        thread_id=thread_file_id
    )

    last_message = messages.data[0].content[0].text.value

    st.session_state.messages.append({"role": "assistant", "content": last_message})
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        message_placeholder.markdown(last_message)


def main():
    st.title('RSS Articles Assistant')

    getAssistantResponse(mainAssistant)

# Call the main function to run the app
if __name__ == "__main__":
    main()
