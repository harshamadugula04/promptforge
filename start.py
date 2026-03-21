import subprocess
import threading
import sys
import os

def run_flask():
    print("🐍 Starting Flask backend...")
    subprocess.run([sys.executable, "server.py"], cwd=os.path.dirname(os.path.abspath(__file__)))

def run_react():
    print("⚛️  Starting React frontend...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    subprocess.run([npm_cmd, "start"], cwd=os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Starting PromptLab...")
    print("   Backend  → http://localhost:5000")
    print("   Frontend → http://localhost:3000")
    print("   Press Ctrl+C to stop both\n")

    flask_thread = threading.Thread(target=run_flask, daemon=True)
    react_thread = threading.Thread(target=run_react, daemon=True)

    flask_thread.start()
    react_thread.start()

    try:
        flask_thread.join()
        react_thread.join()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down PromptLab...")
        sys.exit(0)
