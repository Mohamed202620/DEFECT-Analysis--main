import { GOOGLE_SCRIPT_URL } from "../config.js";

export async function apiRequest(data) {

    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: JSON.stringify(data)
    });

    return await response.json();

}