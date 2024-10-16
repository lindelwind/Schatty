webSocket = new WebSocket("ws://localhost:9990");

const MAX_NUMBER_OF_MESSAGES_ON_SCREEN = 50;
const MESSAGE_PADDING = 15;
let counter = 0;
const audio = new Audio('sound/notificationSound.wav');
const messageContainer = document.getElementById("messagesContainer");


webSocket.onmessage = (event) => {
    console.log(event)
    let data = JSON.parse(event.data);
    switch(data.platform){
        case "youtube": {
            data.messages.forEach((message) => {
                addNewMessage(data.platform, message.displayName, message.text)
            })
            break;
        }
        case "twitch": {
            addNewMessage(data.platform, data.displayName, data.text, data.color)
            break;
        }
    }
}


function moveMessagesUp(id){
    if(id === 0) return;
    let minIndex = id - MAX_NUMBER_OF_MESSAGES_ON_SCREEN < 0 ? 0 : id - MAX_NUMBER_OF_MESSAGES_ON_SCREEN
    
    let message = document.getElementById(id);
    let moveMessage = document.getElementById(minIndex);
    
    let size = message.getBoundingClientRect();
    moveMessage.style.bottom = parseFloat(moveMessage.style.bottom.replace("px","")) + size.height
    
    for(let i = minIndex; i < id; i++){
        let moveMessage = document.getElementById(i);

        moveMessage.style.bottom = `${parseFloat(moveMessage.style.bottom.replace("px","")) + size.height + MESSAGE_PADDING}px`
    }

    if(id > MAX_NUMBER_OF_MESSAGES_ON_SCREEN) {
        document.getElementById(id - MAX_NUMBER_OF_MESSAGES_ON_SCREEN-1).remove()
    }
}

function addNewMessage(platform, displayName, text, color = "#000"){
    let newElement = document.createElement("div");
    newElement.innerHTML = `
        <div class="messageIconContainer ${platform}Background">
            <img class="platformImage" src="img/${platform}.png"/>
        </div>
        <div class="messageDetails">
            <span style="color: ${color}">${displayName}</span>
            <span class="text">:</span>
            <span class="text">${text}</span>
        </div>
    `
    newElement.className="message";
    newElement.style.bottom=`${MESSAGE_PADDING}px`;
    newElement.style.opacity = "0%";
    newElement.id=`${counter}`;
    messageContainer.appendChild(newElement);
    //audio.play();
    moveMessagesUp(counter)
    newElement.style.opacity = "100%";
    counter++;
}