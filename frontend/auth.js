/* auth.js handles registration and login forms */

const API = "";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const errorDiv = document.getElementById("loginError");

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

                localStorage.setItem("username", data.username);
                window.location.href = "/";
            } catch (err) {
                errorDiv.textContent = "Server error. Please try again later.";
                errorDiv.style.display = "block";
            }
        });
    }
});
