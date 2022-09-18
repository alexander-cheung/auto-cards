chrome.storage.local.get("cards", storage => {
	if (chrome.runtime.lastError) {
		ShowError(chrome.runtime.lastError.message);
		return;
	}

	addCategories(storage.cards);

	let exportBtn = document.getElementById("export");

	if (!exportBtn)
		return;

	exportBtn.addEventListener("click", e => {
		let categories = document.getElementById("categories").querySelectorAll("input[type=checkbox]:checked");
		let filename = "cards.txt";
		let fileText = "";

		if (!categories.length) {
			alert("No Categories Have Been Selected");
			return;
		}

		let trans = document.getElementById("addTrans").checked;
		let fileMode = document.getElementById("fileMode").value;

		for (let category of categories) {
			let lang = category.closest(".lang").id;
			for (let [key, value] of Object.entries(storage.cards[lang][category.id])) {
				if (trans)
					fileText += `${key},${value.romanized},${value.def}\n`;
				else
					fileText += `${key},${value.def}\n`;
			}

			if (fileMode === "allFiles") {
				let element = document.createElement('a');
				element.setAttribute('href','data:text/plain;charset=utf-8,' + encodeURIComponent(fileText));
				element.setAttribute('download', category.id);
				document.body.appendChild(element);
				element.click();

				fileText = "";
			}
		}

		if (fileMode !== "allFiles") {
			let element = document.createElement('a');
			element.setAttribute('href','data:text/plain;charset=utf-8,' + encodeURIComponent(fileText));
			element.setAttribute('download', filename);
			document.body.appendChild(element);
			element.click();
		}

		ShowSuccess("Data Successfully Exported");
	});
});

async function addCategories(cards) {
	if (!cards) {
		let msg = document.createElement("p");
		msg.textContent = "Your cards can be exported here.";
		msg.className = "center full-info";

		let container = document.querySelector(".container");
		container.style.height = "220px";
		container.replaceChildren(msg);
		return;
	}

	let categories = document.createElement("div");
	categories.id = "categories";

	let head = document.createElement("h2");
	head.textContent = "Categories";
	head.className = "subhead-one";
	categories.appendChild(head);

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
    	
	for (const [code, langSet] of Object.entries(cards)) {
		let langCat = document.createElement("div");
		langCat.id = code;
		langCat.className = "lang";
		langCat.innerHTML = `<h3 class="subhead-two">${langNames[code]}</h3>`;

		for (let category of Object.keys(langSet)) {
			flag = true;
			langCat.innerHTML +=
				`<div class="checklist">
					<input type="checkbox" id="${category}" class="check-input">
					<label class="check-label" for="${category}">${category}</label><br>
				</div>`;
		}

		categories.appendChild(langCat);
	}

	if (flag)
		document.querySelector(".container").prepend(categories);
	else {
		let msg = document.createElement("p");
		msg.textContent = "Your cards can be exported here.";
		msg.className = "center full-info";

		let container = document.querySelector(".container");
		container.style.height = "220px";
		container.replaceChildren(msg);
		return;
	}

}

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

function ShowSuccess(text) {
    if (document.getElementById("message"))
        return;

    let msg = document.createElement("div");
    msg.id = "message";
    msg.className = "success msg message under-header";

    msg.innerHTML += 
        `<button id="msgClose" class="success icon-close icon-lg" type="button" title="Close"></button>
        <div>${text}</div>`;

    msg.querySelector("#msgClose").addEventListener("click", e => {
        document.getElementById("message").remove();
    });

	document.querySelector(".container").appendChild(msg);
}