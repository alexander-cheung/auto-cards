function Main() {}

chrome.storage.local.get('sched', async storage => {
	try {
		let url = chrome.runtime.getURL("static/lang-codes.json");
		let res = await fetch(url);
		Main.langNames = await res.json();
	} catch(e) {
		ShowError(e);
		return
	}

	if (chrome.runtime.lastError) {
		ShowError(chrome.runtime.lastError.message);
		return;
	}

	storage.sched = storage.sched || {};

	// for scheduling (first is front, 2nd is back)
	function InitSchedule(card) {
		card.status = ["learning", "learning"];
		card.steps_index = [0, 0];
		card.ease_factor = [storage.sched.easeFactor || 250, storage.sched.easeFactor || 250];
		card.interval = [null, null];
		card.dueDate = [0, 0];
	}

	let uploadCards = document.getElementById('importCards');
	let uploadBan = document.getElementById('importBan');
	let cardDrop = document.getElementById('cardDrop');
	let banDrop = document.getElementById('banDrop');

	function importBan(file) {
		let ext = file.name.match(/\.([^\.]+)$/)[1];

		if (ext != "txt") {
			alert('Unsupported File Format');
			this.value = '';
			return;
		}

		// read file
		let read = new FileReader();
		read.onload = async function(evt) {
			let code = await GetCode(evt.target.result, file.name);

			// error
			if (code === null) {
				alert("Unable to parse file");
				uploadBan.value = "";
				return;
			// user terminated process
			} else if (code === false) {
				uploadBan.value = "";
				return;
			}

			let words = evt.target.result.split(/[\p{P}\p{Z}\n]+/gu);
			document.querySelector("#importBan").value = "";

			chrome.storage.local.get("banSets", storage => {
				if (chrome.runtime.lastError) {
					ShowError(chrome.runtime.lastError.message);
					return;
				}

				if (!storage.banSets)
					storage.banSets = {};
				if (!storage.banSets[code])
					storage.banSets[code] = {};

				for (let word of words) {
					if (word)
						storage.banSets[code][word] = true;
				}

				chrome.storage.local.set({"banSets": storage.banSets}, ShowResult);
			});
		}

		read.readAsText(file);
	}

	function importCards(file) {
		// ensure only text files
		var ext = file.name.match(/\.([^\.]+)$/)[1];

		if (ext != "txt") {
			alert('Unsupported File Format');
			this.value = '';
			return;
		}

		// read file
		const reader = new FileReader();
		reader.onload = async function(evt) {
			let rows = evt.target.result.split("\n");
			// using first row as the primary langauge (langTo)
			let front = [];
			let back = [];
			for (var row of rows) {
				terms = row.split(/[,\t]+/);
				if (terms.length == 1) {
					continue;
				}
				front.push(terms[0].trim());
				back.push(terms[terms.length - 1].trim());
			}

			if (!front.length || !back.length) {
				alert("Unable to Parse File");
				return;
			}

			let frontCode;

			try {
				frontCode = await DetectLanguage(front.join(" "));
			} catch(e) {
				console.error(e);
			}

			if (!frontCode.lang)
				frontCode = "en";
			else
				frontCode = frontCode.lang;

			let content = 
				`<div class="input-chunk">
					<div class="bot-space">
						<label for="ctName" class="input-label" style="font-size:14px;">Category Name:</label>
						<input id="ctName" class="text-input" type="text" maxlength="100"><br>
					</div>

					<div class="bot-space">
						<label class="select-label modal-label">Card Front:</label>
						<div class="select-dropdown modal-select inline-select">
							<select id="format" class="modal-select">
								<option value="firstFront">First Row</option>
								<option value="lastFront">Last Row</option>
							</select>
						</div>
						<span class="tool" data-tip="Select the file row which corresponds to the front of the card">
								<span class="icon-info-circle"></span>
						</span>
					</div>

					<div class="bot-space">
						<label class="select-label modal-label">Front Language:</label>
						<div class="select-dropdown modal-select inline-select">
							<select id="frontLang" class="modal-select"></select>
						</div>
						<span class="tool" data-tip="Select the language of the front side">
								<span class="icon-info-circle"></span>
						</span>
					</div>
				</div>
				<button type="button" class="modal-btn btn" id="confirmImport">Confirm</button>`;

			let popup = getPopup(content);

			let selectFragment = new DocumentFragment();
			for (let [code, langName] of Object.entries(Main.langNames)) {
				let option = selectFragment.appendChild(document.createElement('option'));
				option.value = code;
				option.text = langName;
			}
	
			popup.querySelector("#frontLang").appendChild(selectFragment);
			popup.querySelector("#frontLang").value = frontCode || "en";
			document.querySelector("body").appendChild(popup);

			popup.querySelector("#confirmImport").addEventListener("click", e => {
				let category = {};
				let name = document.getElementById("ctName").value;
				let code = document.getElementById("frontLang").value;
				let row = document.getElementById("format").value;

				if (!name) {
					alert("Please Specify a Category Name");
					return;
				}

				if (row === "lastFront") {
					for (let i = 0; i < back.length; i++) {
						category[back[i]] = {"def": front[i]};
						InitSchedule(category[back[i]]);
					}
				} else {
					for (let i = 0; i < front.length; i++) {
						category[front[i]] = {"def": back[i]};
						InitSchedule(category[front[i]]);
					}
				}

				uploadCards.value = "";

				chrome.storage.local.get(["cards", "categoryNames"], storage => {
					if (chrome.runtime.lastError) {
						ShowError(chrome.runtime.lastError.message);
						return;
					}

					storage.cards = storage.cards || {};
					storage.cards[code] = storage.cards[code] || {};
					
					storage.categoryNames = storage.categoryNames || {};
					storage.categoryNames[code] = storage.categoryNames[code] || {};
					storage.sched = storage.sched || {}; 

					if (storage.cards[code][name]) {
						alert("Category Name Taken");
						return;
					}

					storage.cards[code][name] = category;
					storage.categoryNames[code][name] = true;

					chrome.storage.local.set(storage, ShowResult);

					document.getElementById("popupElement").remove();
					e.target.removeEventListener("click");
				});
			});
		};
		reader.readAsText(file);
	}

	uploadCards.onchange = e => {
		importCards(e.target.files[0]);
	};

	cardDrop.addEventListener("dragover", e => {
		e.preventDefault();
	});

	cardDrop.addEventListener("drop", e => {
		e.preventDefault();
		importCards(e.dataTransfer.files[0]);
	});

	uploadBan.onchange = e => {
		importBan(e.target.files[0]);
	};

	banDrop.addEventListener("dragover", e => {
		e.preventDefault();
	});

	banDrop.addEventListener("drop", e => {
		e.preventDefault();
		importBan(e.dataTransfer.files[0]);
	});
});

async function GetCode(text, fileName) {
	ShowLoad();
	let langNames = Main.langNames;
	let result = await DetectLanguage(text);
	
	ShowContent();

	let code;

	if (!langNames[result.lang] && result.prob >= 0.5) {
		code = null;

	} else if (!Object.keys(result).length || result.prob < 0.5) {
		let content = 
			`<div class="input-chunk">
				<label class="select-label modal-label">Language for ${fileName}:</label>
				<div class="select-dropdown modal-select">
					<select id="langSelect" class="modal-select"></select>
				</div>
			</div>
			<button type="button" class="modal-btn btn" id="confirmLang">Confirm</button>`;

		let popup = getPopup(content);

		let selectFragment = new DocumentFragment();
		for (let [code, langName] of Object.entries(langNames)) {
			let option = selectFragment.appendChild(document.createElement('option'));
			option.value = code;
			option.text = langName;
		}

		popup.querySelector("#langSelect").appendChild(selectFragment);
		popup.querySelector("#langSelect").value = result.prediction || "en";
		document.querySelector("body").appendChild(popup);

		try {
			code = await GetLanguage();
		} catch {
			code = false;
		}
	} else {
		code = result.lang;
	}
	return code;
}

async function DetectLanguage(text) {
	let body = JSON.stringify({"includePredictions": "false", "text": text});

	const options = {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-RapidAPI-Key': 'KEY',
			'X-RapidAPI-Host': 'fast-and-highly-accurate-language-detection.p.rapidapi.com'
		},
		body: body
	};
	
	try {
		let res = await fetch('https://fast-and-highly-accurate-language-detection.p.rapidapi.com/detect', options);
		code = await res.json();
		return code;
	} catch(e) {
		console.error(e);
		return {};
	}
}

function GetLanguage() {

	return new Promise((resolve, reject) => {
		document.addEventListener("click", function ClickListener(e) {
			if (e.target.matches("#confirmLang")) {
				let lang = document.querySelector("#langSelect").value;
				e.target.closest("#popupElement").remove();
				document.removeEventListener("click", ClickListener);
				resolve(lang);
			} else if (e.target.matches("#closePopup") || !e.target.matches(`[class^="modal"], [class*=" modal-"]`)) {
				document.querySelector("#popupElement").remove();
				document.removeEventListener("click", ClickListener);
				reject();
			}
		});
	});
}

function getPopup(content) {
	let popup = document.createElement("div");

	popup.id = "popupElement";
	popup.innerHTML =
		`<div class="modal-overlay"></div>
		<div class="modal">
			<div class="modal-close">
				<button type="button" id="closePopup" class="icon-close icon-only"></button>
			</div>
			<div class="modal-title">
			<h1 class="modal-header">Select Language</h1>
			</div>
			<div class="modal-content">
				${content}
			</div>
		</div>`;

	return popup;
}

function ShowLoad() {
	let container = document.querySelector(".container");
	for (let child of container.children) {
		if (child.nodeName != "script")
			child.style.display = "none";
	}

	let center = document.createElement("div");
 	center.className = "center full-popup";
	center.innerHTML = `<div class="loader"></div>`;
	container.appendChild(center);
}

function ShowContent() {
	document.querySelector(".center").remove();

	let container = document.querySelector(".container");
	for (let child of container.children) {
		if (child.nodeName != "script")
			child.style.display = "";
	}
}

function handleResponse(response) {
	if (response.ok) {
		return response.json();
	} else {
		throw new Error(response.status);
	}
}

function ShowSuccess(text) {
    if (document.getElementById("message"))
        return;

    let msg = document.createElement("div");
    msg.id = "message";
    msg.className = "success botMessage";

    msg.innerHTML += 
        `<button id="msgClose" class="success icon-close" type="button" title="Close"></button>
        <div>${text}</div>`;

    msg.querySelector("#msgClose").addEventListener("click", e => {
        document.getElementById("message").remove();
    });

    document.querySelector(".container").appendChild(msg);
}

function ShowError(text) {
	let load = document.querySelector(".center");
	if (load)
		ShowContent();

	let msg = document.createElement("div");
	msg.className = "center-msg";
	msg.innerHTML =
		`<div>Error</div>
		<div>${text}</div>`;

	let container = document.querySelector(".container");
	container.style.display = "";
	container.replaceChildren(msg);
	container.classList.add("center", "full-popup");
}

function ShowResult() {
	if (chrome.runtime.lastError)
		ShowError(chrome.runtime.lastError.message);
	else {
		ShowSuccess("Data Successfully Imported");
	}
}