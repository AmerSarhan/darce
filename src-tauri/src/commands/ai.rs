use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageArgs {
    pub api_key: String,
    pub model: String,
    pub messages: Vec<ChatMsg>,
    pub system_prompt: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Serialize)]
struct StreamChunk {
    token: String,
    done: bool,
}

#[derive(Clone, Serialize)]
struct StreamError {
    message: String,
}

#[tauri::command]
pub async fn send_chat_message(app: AppHandle, args: SendMessageArgs) -> Result<(), String> {
    let client = Client::new();

    let mut api_messages: Vec<serde_json::Value> = vec![
        serde_json::json!({ "role": "system", "content": args.system_prompt })
    ];
    for msg in &args.messages {
        api_messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
    }

    let body = serde_json::json!({
        "model": args.model,
        "messages": api_messages,
        "stream": true
    });

    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", args.api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://darce.dev")
        .header("X-Title", "Darce")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();
        let msg = match status {
            401 => "Invalid API key. Check your OpenRouter key.".to_string(),
            429 => "Rate limit exceeded. Wait a moment or switch models.".to_string(),
            404 => "Model not found. It may have been deprecated.".to_string(),
            _ => format!("API error ({}): {}", status, body_text),
        };
        let _ = app.emit("ai:error", StreamError { message: msg.clone() });
        return Err(msg);
    }

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        // Process all complete lines (handle both \n and \r\n)
        while buffer.contains('\n') {
            let pos = buffer.find('\n').unwrap();
            let line = buffer[..pos].trim_end_matches('\r').trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if line.starts_with("data:") {
                let data = line.trim_start_matches("data:").trim();
                if data == "[DONE]" {
                    let _ = app.emit("ai:token", StreamChunk { token: String::new(), done: true });
                    return Ok(());
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                        let _ = app.emit("ai:token", StreamChunk { token: content.to_string(), done: false });
                    }
                    // Check for finish_reason to catch end of stream
                    if let Some(reason) = parsed["choices"][0]["finish_reason"].as_str() {
                        if reason == "stop" || reason == "end_turn" {
                            let _ = app.emit("ai:token", StreamChunk { token: String::new(), done: true });
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    // Stream ended without [DONE] — still signal completion
    let _ = app.emit("ai:token", StreamChunk { token: String::new(), done: true });
    Ok(())
}

#[tauri::command]
pub async fn validate_api_key(api_key: String) -> Result<bool, String> {
    let client = Client::new();
    let response = client
        .get("https://openrouter.ai/api/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    Ok(response.status().is_success())
}

#[derive(Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub async fn list_models(api_key: String) -> Result<Vec<ModelInfo>, String> {
    let client = Client::new();
    let response = client
        .get("https://openrouter.ai/api/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let body: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;

    let models = body["data"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| {
            Some(ModelInfo {
                id: m["id"].as_str()?.to_string(),
                name: m["name"].as_str()?.to_string(),
            })
        })
        .collect();
    Ok(models)
}

/// Simple non-streaming chat completion — for the teacher/learn feature
#[tauri::command]
pub async fn simple_chat(api_key: String, model: String, prompt: String) -> Result<String, String> {
    let client = Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "user", "content": prompt }
        ],
        "max_tokens": 800,
        "temperature": 0.3
    });

    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://darce.dev")
        .header("X-OpenRouter-Title", "Darce")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let raw_body = response.text().await.map_err(|e| format!("Body read error: {}", e))?;

    log::info!("[simple_chat] Status: {}, Body len: {}", status, raw_body.len());

    if status >= 400 {
        return Err(format!("API error ({}): {}", status, &raw_body[..raw_body.len().min(200)]));
    }

    let data: serde_json::Value = serde_json::from_str(&raw_body)
        .map_err(|e| format!("JSON parse error: {} — body: {}", e, &raw_body[..raw_body.len().min(100)]))?;

    // Try multiple paths to find the content
    let msg = &data["choices"][0]["message"];
    let content = msg["content"].as_str().unwrap_or("").trim();
    let reasoning = msg["reasoning"].as_str().unwrap_or("").trim();
    // Some models put content in "reasoning_content"
    let reasoning2 = msg["reasoning_content"].as_str().unwrap_or("").trim();

    log::info!("[simple_chat] content len: {}, reasoning len: {}, reasoning2 len: {}", content.len(), reasoning.len(), reasoning2.len());

    // Use content if available, otherwise try reasoning fields
    let result = if !content.is_empty() {
        content.to_string()
    } else if !reasoning.is_empty() {
        reasoning.to_string()
    } else if !reasoning2.is_empty() {
        reasoning2.to_string()
    } else {
        log::warn!("[simple_chat] All fields empty. Full msg: {}", msg);
        return Err(format!("Model returned empty. Try a different model. Raw: {}", &raw_body[..raw_body.len().min(200)]));
    };

    Ok(result)
}

/// Send beta signup — stores locally and optionally calls webhook
#[tauri::command]
pub async fn send_signup_email(email: String) -> Result<(), String> {
    // Log signup locally
    log::info!("[signup] New beta signup: {}", email);

    // Try to send via webhook (if configured via env var at build time)
    let resend_key = option_env!("DARCE_RESEND_KEY").unwrap_or("");
    let notify_email = option_env!("DARCE_NOTIFY_EMAIL").unwrap_or("");

    if !resend_key.is_empty() && !notify_email.is_empty() {
        let client = Client::new();
        let body = serde_json::json!({
            "from": "Darce <beta@darce.dev>",
            "to": [notify_email],
            "subject": format!("New Darce Beta Signup: {}", email),
            "html": format!("<p><strong>Email:</strong> {}</p><p>Signed up from Darce desktop app.</p>", email)
        });

        let response = client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", resend_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Email failed: {}", e))?;

        if !response.status().is_success() {
            let err = response.text().await.unwrap_or_default();
            log::warn!("[signup] Email failed: {}", err);
        }
    }

    Ok(())
}

/// Fetch any OpenRouter API endpoint (for usage, models, etc)
#[tauri::command]
pub async fn simple_chat_raw(url: String, api_key: String) -> Result<String, String> {
    let client = Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    response.text().await.map_err(|e| format!("Read error: {}", e))
}
