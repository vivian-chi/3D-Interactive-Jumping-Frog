# Jumping Frog — Interactive 3D Web Experience

A delightful interactive 3D experience featuring a cute green frog sitting in a soft, pastel-green environment. 

## Features
- **3D Interactive Frog**: A high-quality 3D model that reacts to user interaction.
- **Dynamic Jumping**: Click/Tap the frog to make it jump to a new random position.
- **Idle Behavior**: The frog will jump on its own if left idle for 30 seconds.
- **Cursor Tracking**: The frog's eyes and head subtly follow your mouse or touch movements.
- **Smooth Animations**: Custom procedural animations for squash-and-stretch jumping and breathing.

## Technology Stack
- **Three.js**: For 3D rendering and model loading.
- **Vanilla JavaScript**: All logic and animations are built using standard JS (ES Modules).
- **CSS**: Pure CSS for the loading UI and vignette effects.

## How to Run Locally

Because this project uses ES Modules and loads a 3D model, it cannot be run by simply opening the `index.html` file in a browser. You must use a local web server.

### Options:

#### Option A: Using `npx` (Requires Node.js)
```bash
npx serve .
```

#### Option B: Using Python (Built into Mac/Linux)
```bash
python3 -m http.server
```

Once the server is running, open the provided URL (usually `http://localhost:3000` or `http://localhost:8000`) in your browser.

## Project Structure
- `index.html`: Entry point.
- `assets/`: Contains the 3D model (`.glb`).
- `js/`: Application logic (Scene setup, Animation, Interaction).
- `.gitignore`: Standard exclusion list for cleaner version control.

## Credits
- **Image Generation**: [nano banana](https://nanobanana.com)
- **3D Model & Materials**: [Meshly AI](https://meshly.ai)
- **Coding**: [Claude Code](https://claude.ai)

## License
This project is open-source and available under the MIT License.
