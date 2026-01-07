# cozy-cat-for-ST
a SillyTavern extension that adds an immersive, interactive pet cat companion to your roleplay chats. It tracks your kitten's age, status, and displays a beautiful overlay UI inspired by cozy mobile apps. 

> **Note:** This extension is designed to work with specific a character card and Lorebooks that output data in a format the extension can read, which is "Your Pet Cat."

## ✨ Features

* **Interactive Overlay:** A "phone-like" interface accessible via a draggable **Paw Button** 🐾.
  

<img src="UI Preview/01-home.jpg"  width= "300" > 


* **Status Tracking:** Automatically tracks dynamic stats based on roleplay context:
    * 🥩 **Hunger**
    * 🧸 **Happiness**
    * 🧼 **Hygiene**
    * ⚡ **Energy**
    * ❤ **Health Status** (Healthy, Weak, Sick, Injured, Critical)

* **Growth System:** Tracks the cat's age based on Calendar UI in the chat.

<img src="UI Preview/04-status.jpg"  width= "300" > 


* **Pet Card:** A flippable card showing your cat's personality traits.

<img src="UI Preview/02-card-front.jpg"  width= "300" > <img src="UI Preview/03-card-back.jpg"  width= "300" > 

* **Music Player:** A built-in vinyl player that plays a cozy background loop.

<img src="UI Preview/05-music.jpg"  width= "300" > 

* **Per-Chat Persistence:** Cat data is saved specifically for each chat session, which can be reset by user.

<img src="UI Preview/reset.jpg"  width= "300" > 

## 📦 Installation

1.  Open SillyTavern.
2.  Go to **Extensions** > **Install Extension**.
3.  Paste the URL of this repository (or unzip the files into `SillyTavern/public/scripts/extensions/cozy-cat-for-ST`).
4.  Reload SillyTavern.
5.  Ensure the extension is enabled in the Extensions menu.

## 📖 How it Works 

This extension listens for specific **hidden HTML comments** in the AI's output to update the UI.


## 🔥 Special Thanks: 
- POPKO: Thanks for helping me start things off; otherwise, I wouldn’t know where to begin.
- Zeal: Without you, I would have released the extension without realizing there was a serious issue.
- Fox.Jong, Malibee, Madee, Hamster: Thank for being helpful testers.
- Phakrop: My Luck Bringer.

