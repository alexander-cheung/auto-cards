LoadCategories();

function LoadCategories() {
	chrome.storage.local.get("categoryNames", async function(data) {
		if (chrome.runtime.lastError) {
			ShowError(chrome.runtime.lastError.message);
			return;
		}

		data.categoryNames = data.categoryNames || {};

		let categories = document.createElement("div");
		categories.id = "categories";
		categories.innerHTML = "<h2 class='subhead-one'>Categories</h2>";

		let langNames = {};
		
		try {
			let url = chrome.runtime.getURL("static/lang-codes.json");
			let res = await fetch(url);
			langNames = await res.json();
		} catch(e) {
			ShowError(e);
			return;
		}

		let flag = false;

		for (const [code, langSet] of Object.entries(data.categoryNames)) {
			let cats = Object.keys(langSet);

			if (!cats.length) {
				continue;
			}

			let langCat = document.createElement("div");
			langCat.id = code;
			langCat.className = "lang"; 
			langCat.innerHTML = `<h3 class="subhead-two">${langNames[code]}</h3>`;

			for (let category of cats) {
				flag = true;
				langCat.innerHTML +=
					`<div class="checklist">
						<input type="checkbox" id="${category}" class="check-input">
						<label for="${category}" class="check-label">${category}</label><br>
					</div>`;
			}

			categories.appendChild(langCat);
		}

		if (!flag) {
			let msg = document.createElement("p");
			msg.className = "center full-info";
			msg.textContent = "After creating some cards, you will be able to practice with them here."; 
			
			let container = document.querySelector(".container");
			container.style.height = "300px";
			container.replaceChildren(msg);
		} else {
			document.querySelector(".container").prepend(categories);
		}
	});
}

document.getElementById("practice").addEventListener("click", () => {
	let mode = document.getElementById("cardMode").value;
	let cardAmt = document.getElementById("cardAmt").value;
	cardAmt = cardAmt === "all" ? "all" : parseInt(cardAmt);

	let studyDue = document.getElementById("studyDue").checked;

	let categories = {};
	let languages = document.querySelectorAll(".lang");
	let flag = false;

	for (let language of languages) {
		categories[language.id] = {};

		let cats = language.querySelectorAll(".check-input:checked");
		for (let cat of cats) {
			categories[language.id][cat.id] = true;
			flag = true;
		}
	}

	if (!flag) {
		alert("No Categories Selected");
		return;
	}

	let settings = {"mode": mode, "cardAmt": cardAmt, "categories": categories, "studyDue": studyDue};
	chrome.storage.local.set({"pConfig": settings}, async () => {
		OnError();
		let practice;
		
		try {
			let url = chrome.runtime.getURL("static/templates/practice.html");
			
			let res = await fetch(url);
			practice = await res.text();
		} catch(e) {
			ShowError(e);
			return;
		}
	
		document.open();
		document.write(practice);
		document.close();
	});
});

function ShowError(text) {
	let msg = document.createElement("div");
	msg.className = "center-msg";
	msg.innerHTML =
		`<div>Error</div>
		<div>${text}</div>`;

	let container = document.querySelector(".container");
	container.replaceChildren(msg);
	container.classList.add("center");
}

function OnError() {
	if (chrome.runtime.lastError)
		ShowError(chrome.runtime.lastError.message);
}