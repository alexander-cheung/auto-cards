Main();

async function Main() {
	let storage;
	try {
		storage = await getStorageData(["settings", "sched"]);
		storage.settings = storage.settings || {};
		storage.sched = storage.sched || {};

	} catch (e) {
		ShowError(e);
	}

	InitSettings(storage);

	document.addEventListener('change', function (event) {
		if (event.target.matches("#darkMode")) {
			if (event.target.checked) {
				storage.settings.darkMode = true;
				
				document.documentElement.setAttribute("data-theme", "dark");
				dark = true;
			} else {
				storage.settings.darkMode = false;
				
				document.documentElement.setAttribute("data-theme", "");
				dark = false;
			}
		
		} else if (event.target.matches("#zhOption")) {
			if (event.target.checked) {
				storage.settings.zhOption = true;
			} else {
				storage.settings.zhOption = false;
			}

		} else if (event.target.matches("#transliterate")) {
			if (event.target.checked) {
				storage.settings.transliterate = true;
			} else {
				storage.settings.transliterate = false;
			}

		} else if (event.target.matches("#dailyMode")) {
			storage.settings.dailyMode = event.target.value;
		
		} else if (event.target.matches("#dailyMax")) {
			storage.settings.dailyMax = event.target.value;

		} else if (event.target.matches("#langTo")) {
			storage.settings.langTo = event.target.value;

		// scheduling
		} else if (event.target.matches(`#gradInt, #easyInt, #startEase, #easyBonus, #intMod, #hardInt, #newInt`)) {
			let number = parseInt(event.target.value);
			let max = event.target.getAttribute("max");
			let min = event.target.getAttribute("min");

			if (number >= min && number <= max)
				storage.sched[event.target.id] = number;
			else if (number > max) {
				event.target.value = storage.sched[event.target.id] = max;
			} else if (number < min) {
				event.target.value = storage.sched[event.target.id] = min;
			}
		}

		chrome.storage.local.set(storage, OnError);
	});

	document.addEventListener("click", event => {
		if (event.target.matches("#gradIntBtn")) {
			document.getElementById("gradInt").value = storage.sched.gradInt = 1;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#easyIntBtn")) {
			document.getElementById("easyInt").value = storage.sched.easyInt = 4;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#startEaseBtn")) {
			document.getElementById("startEase").value = storage.sched.startEase = 250;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#easyBonusBtn")) {
			document.getElementById("easyBonus").value = storage.sched.easyBonus = 130;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#intModBtn")) {
			document.getElementById("intMod").value = storage.sched.intMod = 100;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#hardIntBtn")) {
			document.getElementById("hardInt").value = storage.sched.hardInt = 120;
			chrome.storage.local.set(storage, OnError);

		} else if (event.target.matches("#newIntBtn")) {
			document.getElementById("newInt").value = storage.sched.newInt = 70;
			chrome.storage.local.set(storage, OnError);
		}
	});
}

function InitSettings(storage) {
	let url = chrome.runtime.getURL("static/lang-codes.json");
	fetch(url)
	.then(response => {
		if (response.ok) {
			return response.json();
		} else {
			ShowError(response.status);
		}
	}).then(codes => {
		// initialize language options
		let langDiv = document.createElement("div");
		langDiv.innerHTML = `<label class="select-label" for="langTo">Translate Into</label>
			<div class="select-dropdown"><select id="langTo"></select></div>`;
		let langSelect = langDiv.querySelector("#langTo");

		for (const [code, lang] of Object.entries(codes)) {
			let langOption = document.createElement("option");
			langOption.textContent = lang;
			langOption.value = code;
			langSelect.appendChild(langOption);
		}

		document.getElementById("createHead").insertAdjacentElement("afterend", langDiv);

		// prefill values
		if (storage.settings.darkMode == false) {
			document.getElementById("darkMode").checked = false;
		}
		if (storage.settings.langTo) {
			document.getElementById("langTo").value = storage.settings.langTo;
		}
		if (storage.settings.dailyMax) {
			document.getElementById("dailyMax").value = storage.settings.dailyMax;
		}
		if (storage.settings.dailyMode) {
			document.getElementById("dailyMode").value = storage.settings.dailyMode;
		}
		if (storage.settings.zhOption === false) {
			document.getElementById("zhOption").checked = false;
		}
		if (storage.settings.transliterate) {
			document.getElementById("transliterate").checked = true;
		}

		// scheduling
		if (storage.sched.gradInt) {
			document.getElementById("gradInt").value = storage.sched.gradInt;
		}
		if (storage.sched.easyInt) {
			document.getElementById("easyInt").value = storage.sched.easyInt;
		}
		if (storage.sched.startEase) {
			document.getElementById("startEase").value = storage.sched.startEase;
		}
		if (storage.sched.easyBonus) {
			document.getElementById("easyBonus").value = storage.sched.easyBonus;
		}
		if (storage.sched.intMod) {
			document.getElementById("intMod").value = storage.sched.intMod;
		}
		if (storage.sched.hardInt) {
			document.getElementById("hardInt").value = storage.sched.hardInt;
		}
		if (storage.sched.newInt) {
			document.getElementById("newInt").value = storage.sched.newInt;
		}
	})
	.catch(error => ShowError(error));
}

function getStorageData(top_key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(top_key, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
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

function OnError() {
	if (chrome.runtime.lastError)
		ShowError(chrome.runtime.lastError.message);
}