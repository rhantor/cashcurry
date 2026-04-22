export const getUserFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.error("Error parsing user from localStorage:", err);
    return null;
  }
};
