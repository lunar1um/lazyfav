# lazyfav
A cli tool to quickly like the currently playing spotify track!!! (without having to open spotify)

## Installation
### Setting up Spotify API Credentials
1. Head to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) to create a new app (login if you haven't).
2. Fill the required fields:
- App name, Description: Can be anything
- Redirect URI: `http://127.0.0.1:8888/callback`
- Choose `Web API` in the `Which API/SDKs are you planning to use?` section
3. Check the TOS box and click **Save**
4. Once you are in the Dashboard, click on the previously created app. Copy the **Client ID** and **Client Secret** (Hidden under `View client secret` button).

### Setting up Configurations
1. Locate your configuration folder:
- Linux: `~/.config/lazyfav` or `$XDG_CONFIG_HOME/lazyfav`
- Windows: `%APPDATA%\lazyfav\Config`
- MacOS: `~/Library/Preferences/lazyfav`
2. Create a file named `config.json` inside the config folder with the following content:
```json
{
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

### Getting the binary
1. Download the latest [release](https://github.com/lunar1um/lazyfav/tree/main/releases) that matches your operating system.
2. Extract the downloaded archive.
3. Move the extracted binary to a directory in your PATH.

### Authorize
1. Run the binary
2. It will automatically open a browser window to authorize the application (make sure to double check the permissions).
3. After that, it should be working flawlessly. Enjoy!

## Usage
Just simply run the binary. That's all.
