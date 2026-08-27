import { apiRequest } from "./services/api.js";

export async function doLogin() {

}

export async function login(phone, password) {

    return await apiRequest({
        action: "login",
        phone: phone,
        password: password
    });

}