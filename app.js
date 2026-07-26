// Portfolio Pulse — Milestone 1
// Frontend-only stub. Backend (Workers + D1 + KV) arrives in later milestones.

const rows = document.getElementById("rows");
const input = document.getElementById("ticker");
const addBtn = document.getElementById("add-btn");

const watchlist = new Set();

function render() {
  if (watchlist.size === 0) {
    rows.innerHTML = `<tr class="empty"><td colspan="4">No tickers yet — add one above.</td></tr>`;
    return;
  }
  rows.innerHTML = [...watchlist]
    .map(
      (t) => `
      <tr>
        <td><strong>${t}</strong></td>
        <td>—</td>
        <td>—</td>
        <td><button data-t="${t}" class="rm">✕</button></td>
      </tr>`
    )
    .join("");
}

addBtn.addEventListener("click", () => {
  const t = input.value.trim().toUpperCase();
  if (!t) return;
  watchlist.add(t);
  input.value = "";
  render();
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBtn.click();
});

rows.addEventListener("click", (e) => {
  if (e.target.classList.contains("rm")) {
    watchlist.delete(e.target.dataset.t);
    render();
  }
});
