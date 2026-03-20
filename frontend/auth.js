/* auth.js handles registration and login forms */

const API = "";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    // Check for messages in URL
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get("message");
    const successDiv = document.getElementById("loginSuccess");
    if (message && successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = "block";
    }

    // Set user display if on board page
    const userDisplay = document.getElementById("userDisplay");
    const storedUsername = localStorage.getItem("username") || getCookie("username");
    if (userDisplay && storedUsername) {
        userDisplay.textContent = `Hi, ${storedUsername}`;
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const errorDiv = document.getElementById("loginError");
            if (successDiv) successDiv.style.display = "none";

            try {
                const response = await fetch(`${API}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    errorDiv.textContent = data.detail || "Login failed";
                    errorDiv.style.display = "block";
                    return;
                }

                localStorage.setItem("username", data.username);
                // Cookies are set by the backend, but we can also set the 'is_logged_in' for client-side legacy checks if needed
                document.cookie = "is_logged_in=true; path=/; max-age=86400";
                window.location.href = "/";
            } catch (err) {
                errorDiv.textContent = "Server error. Please try again later.";
                errorDiv.style.display = "block";
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const errorDiv = document.getElementById("registerError");

            try {
                const response = await fetch(`${API}/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    errorDiv.textContent = data.detail || "Registration failed";
                    errorDiv.style.display = "block";
                    return;
                }

                // Redirect to login with success message
                window.location.href = `/login?message=Registration%20successful!%20Please%20log%20in.`;
            } catch (err) {
                errorDiv.textContent = "Server error. Please try again later.";
                errorDiv.style.display = "block";
            }
        });
    }

    // Password visibility toggle
    document.querySelectorAll(".toggle-password").forEach(button => {
        button.addEventListener("click", () => {
            const input = button.previousElementSibling || button.closest('.password-wrapper').querySelector('input');
            const eyeContainer = button.querySelector(".eye-icon");

            const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

            if (input.type === "password") {
                input.type = "text";
                eyeContainer.innerHTML = EYE_OFF_ICON;
            } else {
                input.type = "password";
                eyeContainer.innerHTML = EYE_ICON;
            }
        });
    });
});

function logout() {
    localStorage.removeItem("username");
    // Clear cookies
    document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "is_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
