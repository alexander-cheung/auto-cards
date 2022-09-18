async function Main() {
	let langNames = {}; let result;
	try {
		result = await getStorageData(["banSets", "hsk_ban", "langTo"]);

		let url = chrome.runtime.getURL("static/lang-codes.json");
		let res = await fetch(url);
		langNames = await res.json();

		result.banSets = result.banSets || {};

		if (!result.hsk_ban)
			result.hsk_ban = Array(6).fill(false);

	} catch(e) {
		ShowError(e);
		return;
	}

	await RenderBanSet(result, langNames);
	SetListeners(result, langNames);
}

Main();

async function RenderBanSet(storage, langNames) {
	let hsk = document.getElementsByClassName('list');

	// check boxes if option set true
	for (let i = 0; i < hsk.length; i++) {
		// first check the banned lists
		if (storage.hsk_ban[i]) {
			hsk[i].checked = true;
		}
	}

	let banFrag = new DocumentFragment();

	for (const [code, set] of Object.entries(storage.banSets)) {
		let collapsible = document.createElement("div");
		collapsible.className = "nested-collapsible";
		collapsible.innerHTML = 
			`<input class="coll-input" id="${code}-coll" type="checkbox">
			<label for="${code}-coll" class="coll-label">
				<h1 class="coll-header header">
					${langNames[code]}
					<div class="right-icon">
						<button type="button" value="${code}" class="icon-only right-icon btn icon-trash" title="Remove Ban Set"></button>
					</div>
				</h1>	
			</label>
		
			<div id="${code}" class="coll-cont">
				<div class="card">
					<button class="add">Add a Word</button>
				</div>
			</div>`;
		let banCards = new DocumentFragment();

		for (let word of Object.keys(set)) {
			// doc fragment to add new html to
			banCards.appendChild(document.createElement("hr"));
			// init card
			let newCard = document.createElement("div");
			newCard.className = "flex card";

			// add to card then fragment and insert in dom
			newCard.innerHTML += `<p class="ban-card">${word}</p><button type="button" value="${word}" class="btn error icon-trash-o icon-only right-icon" title="Unblock Card"></button>`;

			banCards.appendChild(newCard);
		}

		collapsible.querySelector(`#${code}`).appendChild(banCards);
		banFrag.appendChild(collapsible);
	}

	if (banFrag.children.length) {
		let spacing = document.createElement("div");
		spacing.className = "spacing";
		banFrag.prepend(spacing);

		document.getElementById("replace").replaceWith(banFrag);
	}
}

function SetListeners(storage, langNames) {
	
	document.addEventListener('click', function (event) {
		// remove popup
		let popup = document.getElementById("popupElement");
		if (popup && (event.target.matches("#closePopup") || !event.target.matches(`[class^="modal"], [class*=" modal-"]`))) {
			popup.remove();
		}

		if (event.target.matches('.list')) {

			if (event.target.checked) {
				storage.hsk_ban[event.target.value - 1] = true;
				chrome.storage.local.set({"hsk_ban": storage.hsk_ban}, OnError);
			} else {
				storage.hsk_ban[event.target.value - 1] = false;
				chrome.storage.local.set({"hsk_ban": storage.hsk_ban}, OnError);
			}

		} else if (event.target.matches('.icon-trash-o')) {
			let code = event.target.closest(".coll-cont").id;

			if (storage.banSets[code][event.target.value]) {
				delete storage.banSets[code][event.target.value];
				chrome.storage.local.set({"banSets": storage.banSets}, OnError);
			}

			event.target.closest(".card").previousSibling.remove();
			event.target.closest(".card").remove();

		} else if (event.target.matches('.add')) {

			let newCard = document.createElement("div");
			newCard.className = "card";
			newCard.innerHTML = 
				`<div class="flex input-chunk bot-space">
					<input class="text-input" maxlength="100" type="text">
					<button type="button" class="icon-only right-icon error btn icon-trash-o" title="Unblock Card"></button>
				</div>
				<button type="button" value="confirm" class="btn">Confirm</button>`;
	
			event.target.parentElement.insertAdjacentElement("afterend", newCard);
			event.target.parentElement.insertAdjacentElement("afterend", document.createElement("hr"));
	
		} else if (event.target.value == "confirm") {
			let word = event.target.parentElement.querySelector(".text-input").value;

			if (!word) {
				alert("No Word Has Been Given");
				return;
			}

			let code = event.target.closest(".coll-cont").id;

			storage.banSets[code][word] = true;
			chrome.storage.local.set({"banSets": storage.banSets}, OnError);

			let newCard = document.createElement("div");
			newCard.className = "flex card";

			// add to card then fragment and insert in dom
			newCard.innerHTML += 
				`<p class="ban-card">${word}</p>
				<button type="button" value="${word}" class="icon-only right-icon error btn icon-trash-o" title="Unblock Word"></button>`;

			event.target.parentElement.replaceWith(newCard);

		} else if (event.target.matches("#addSet")) {
			let pop = document.getElementById("popupElement");
			if (pop) {
				return;
			}

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
						<div class="input-chunk">
							<label class="select-label modal-label">Language for Ban Set:</label>
							<div class="select-dropdown" style="margin: 15px 0;">
								<select id="langSelect" class="modal-select"></select>
							</div>
						</div>
						<button type="button" class="modal-btn btn" id="confirmLang">Confirm</button>
					</div>
				</div>`;
	
			let selectFragment = new DocumentFragment();
			let banCats = Object.keys(storage.banSets);
			for (let [code, langName] of Object.entries(langNames)) {
				if (!banCats.includes(code)) {
					let option = selectFragment.appendChild(document.createElement('option'));
					option.value = code;
					option.text = langName;
				}
			}
	
			popup.querySelector("#langSelect").appendChild(selectFragment);
			document.querySelector("body").appendChild(popup);

		} else if (event.target.matches("#confirmLang")) {
			let code = document.querySelector("#langSelect").value;
			storage.banSets[code] = {};
			chrome.storage.local.set({"banSets": storage.banSets}, OnError);

			let collapsible = document.createElement("div");
			collapsible.className = "nested-collapsible";
			collapsible.innerHTML = 
				`<input class="coll-input" checked id="${code}-coll" type="checkbox">
				<label for="${code}-coll" class="coll-label">
					<h1 class="coll-header header flex">
						${langNames[code]}
						<button type="button" value="${code}" class="right-icon icon-only btn icon-trash" title="Remove Ban Set"></button>
					</h1>
				</label>

				<div id="${code}" class="coll-cont">
					<div class="card">
						<button class="add">Add a Word</button>
					</div>
				</div>`;

			let banSets = document.getElementById("banContainer");
			banSets.appendChild(collapsible);

			let toReplace = document.getElementById("replace");

			if (toReplace) {
				let spacing = document.createElement("div");
				spacing.className = "spacing";
				toReplace.replaceWith(spacing);
			}
			document.getElementById("popupElement").remove();

		} else if (event.target.matches(".icon-trash")) {
			if (confirm("Are you sure you want to delete this ban set?")) {
				let lang = event.target.value;

				delete storage.banSets[lang];
				chrome.storage.local.set({"banSets": storage.banSets}, OnError);

				event.target.closest(".nested-collapsible").remove();
			}
		}
	}, false);
};

function getStorageData(sKey) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get(sKey, function(items) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(items);
      }
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