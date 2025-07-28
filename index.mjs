#!/usr/bin/env node

import fs from "fs/promises";
import open from "open";
import http from "http";
import path from "path";
import envPaths from "env-paths";

let client_id = "";
let client_secret = "";

const redirect_uri = "http://127.0.0.1:8888/callback";

function getAuthUrl() {
  const scope =
    "playlist-read-private user-read-playback-state user-read-currently-playing user-library-read user-library-modify";
  const state = Math.random().toString(36).substring(2);
  return (
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id,
      redirect_uri,
      scope,
      state,
    })
  );
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url.startsWith("/callback")) return;

      const url = new URL(req.url, "http://127.0.0.1:8888");
      const code = url.searchParams.get("code");

      if (!code) {
        res.writeHead(400);
        res.end("No code received.");
        server.close();
        return reject("No code in callback.");
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Spotify auth complete. You can close this window.</h1>");
      server.close();
      resolve(code);
    });

    server.listen(8888, () => {
      console.log("Listening for Spotify callback on port 8888...");
    });
  });
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Token exchange failed: " + JSON.stringify(data));
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    timestamp: Date.now(),
  };
}

async function refreshAccessToken(refresh_token) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Refresh failed: " + JSON.stringify(data));
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    expires_in: data.expires_in,
    timestamp: Date.now(),
  };
}

async function loadTokens() {
  const paths = envPaths("lazyfav", { suffix: "" });
  const tokenFile = path.join(paths.data, "spotify_tokens.json");

  try {
    const raw = await fs.readFile(tokenFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveTokens(tokens) {
  const paths = envPaths("lazyfav", { suffix: "" });
  const tokenFile = path.join(paths.data, "spotify_tokens.json");

  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(tokens, null, 2));
}

async function getPlayingTrack(access_token) {
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  if (response.status === 204) {
    return null; // no track playing
  }

  const data = await response.json();

  if (!response.ok) {
    console.error("Fetch error: ", data);
    return null;
  }

  return data;
}

async function checkIfLiked(access_token, trackID) {
  const response = await fetch(
    `https://api.spotify.com/v1/me/tracks/contains?ids=${trackID}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${access_token}` },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Fetch error: ", data);
    return null;
  }

  return data;
}

async function likeSong(access_token, trackID) {
  const response = await fetch("https://api.spotify.com/v1/me/tracks", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({ ids: [trackID] }),
  });

  return response.ok;
}

async function readConfig() {
  const paths = envPaths("lazyfav", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  try {
    await fs.access(configPath);
    const data = await fs.readFile(configPath, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function main() {
  let tokens = await loadTokens();
  let conf = await readConfig();

  if (!conf) {
    console.log("No configuration file found.");
    const paths = envPaths("lazyfav", { suffix: "" });
    console.log(
      `Create a config.json file at: ${path.join(paths.config, "config.json")}`,
    );
    console.log(
      'With content like: {"client_id": "your_id", "client_secret": "your_secret"}',
    );
    return;
  }

  client_id = conf.client_id;
  client_secret = conf.client_secret;

  if (tokens === null) {
    console.log("Opening browser to log in...");
    await open(getAuthUrl());
    const code = await startServer();
    tokens = await exchangeCodeForTokens(code);
    await saveTokens(tokens);
  }

  const expires_in = tokens.expires_in || 3600;
  const age = (Date.now() - tokens.timestamp) / 1000;

  if (age > expires_in - 60) {
    console.log("Access token expired. Refreshing...");
    tokens = await refreshAccessToken(tokens.refresh_token);
    await saveTokens(tokens);
  }

  const track = await getPlayingTrack(tokens.access_token);

  if (!track || !track.item) {
    console.log("No track currently playing.");
    return;
  }

  console.log(
    "Now playing:",
    track.item.name,
    "by",
    track.item.artists.map((a) => a.name).join(", "),
  );

  const isLiked = await checkIfLiked(tokens.access_token, track.item.id);

  if (isLiked[0] === true) {
    console.log("Playing track is already liked!");
  } else {
    await likeSong(tokens.access_token, track.item.id);
    console.log("Track liked!");
  }
}

main();
