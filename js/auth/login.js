import { apiRequest } from "../services/api.js";

export async function login(phone, password) {

    return await apiRequest({
        action: "login",
        phone,
        password
    });

}