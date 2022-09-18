document.addEventListener("DOMContentLoaded", async () => {
	let UNIQUE_ID = 0; let data;

	let langNames = {};
	try {
		data = await getStorageData(["cards", "categoryNames", "sched"]);

		data.cards = data.cards || {};
		data.categoryNames = data.categoryNames || {};
		data.sched = data.sched || {};

		let url = chrome.runtime.getURL("static/lang-codes.json");
		let res = await fetch(url);
		langNames = await res.json();
	} catch(e) {
		ShowError(e);
		return;
	}

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
	  
	async function Main() {	  
		await RenderContent();
		addListeners();
	}
	
	Main();
	
	async function RenderContent() {
		let container = document.querySelector(".container");
		let cardsDiv = new DocumentFragment();
		let cards = Object.entries(data.cards);
	
		if (cards.length) {
			for (const [langCode, langSets] of cards) {
				if (!Object.keys(langSets).length) {
					continue;
				}
				let lang = langNames[langCode];
	
				let langDiv = document.createElement("div");
				langDiv.className = "collapsible";
				langDiv.id = langCode;
				langDiv.innerHTML = 
					`<input class="coll-input" type="checkbox" id="${langCode}-input">
					<label class="coll-label" for="${langCode}-input">
						<h1 class="coll-header header">
							${lang}
							<div class="right-icon">
								<button type="button" value="${langCode}" class="icon-only btn icon-trash-lang" title="Remove Category"></button>
							</div>
						</h1>
					</label>

					<div class="coll-cont">
						<div class="spacing"></div>
					</div>`
				// make categories in each lang
				for (const categoryName of Object.keys(langSets)) {
					// doc fragment to add new html to
					const collapsible = document.createElement("div");
					collapsible.className = "nested-collapsible";
					collapsible.innerHTML = 
						`<input class="coll-input" type="checkbox" id="${UNIQUE_ID}">
						<label class="coll-label" for="${UNIQUE_ID}">
							<h1 class="coll-header header">
								${categoryName}
								<div class="right-icon">
									<button type="button" value="${categoryName}" class="btn icon-call_merge icon-only" title="Merge Category"></button>
									<button type="button" value="${categoryName}" class="btn icon-trash icon-only" title="Remove Category"></button>
								</div>
							</h1>
						</label>`;
					UNIQUE_ID++;

					let category = document.createElement("div");
					category.className = "coll-cont";
					category.id = `${langCode}_${categoryName}`;
					category.setAttribute("data-name", categoryName);
					category.innerHTML =
						`<div class="coll-top">
							<div class="card">
								<label class="input-label">Name:</label>
								<input class="text-input change-cat" type="text" maxlength="100" value="${categoryName}">
							</div>
							<hr>
							<div class="card">
								<button type="button" class="btn add">Add Cards</button>
							</div>
						</div>`;
	
					// each card in a category
					for (const [key, value] of Object.entries(data.cards[langCode][categoryName])) {
						category.appendChild(document.createElement("hr"));
	
						// init card
						let newCard = document.createElement("div");
						newCard.className = "card";
						newCard.setAttribute("class", "card");
	
						let romanized = value.romanized ? value.romanized : "";
	
						// add to card then fragment and insert in dom
						newCard.innerHTML += 
							`<button type="button" class="top-right btn icon-trash-o icon-only" title="Delete Card"></button>
							<div class="input-chunk double-align bot-space">
								<label class="input-label">Word:</label>
								<input id="${key}" type="text" save-popup="true" class="word-card text-input right-icon" value="${key}" maxlength="1000">
							</div>
							<div class="input-chunk double-align bot-space">
								<label class="input-label">Romanized:</label>
								<input type="text" save-popup="true" class="romanized-card text-input right-icon" value="${romanized}" maxlength="200">
							</div>
							<div class="input-chunk double-align">
								<label class="input-label">Definition:</label>
								<input type="text" save-popup="true" class="def-card text-input right-icon" value="${value.def}" maxlength="1000">
							</div>`;
	
						category.appendChild(newCard);
					}
	
					collapsible.appendChild(category);
					langDiv.querySelector(".coll-cont").appendChild(collapsible);
				}
	
				cardsDiv.appendChild(langDiv);
			}
		} else {
			let p = document.createElement("p");
			p.textContent = "Your card sets will be displayed here.";
			p.style['margin-bottom'] = "10px";
			p.style['font-size'] = "20px";
			cardsDiv.appendChild(p);
		}
		ShowContent();
		container.prepend(cardsDiv);

		let btn = document.createElement("button");
		btn.type = "button";
		btn.style = "margin-bottom: 2em;"
		btn.id = "addCat";
		btn.textContent = "Add a Category";

		container.appendChild(btn);
	}
	
	function addListeners() {
		document.addEventListener('click', function (event) {
			// remove merge popup
			let merge = document.getElementById("popupElement");
			if (merge && (event.target.matches("#closePopup") || !event.target.matches(`[class^="modal"], [class*=" modal-"]`))) {
				merge.remove();
			}
	
			// delete word
			if (event.target.matches('.icon-trash-o')) {
				let category = event.target.closest(".coll-cont").getAttribute("data-name");
				let lang = event.target.closest(".collapsible").id;
				let word = event.target.nextElementSibling.querySelector(".word-card").value;
	
				if (data.cards[lang][category][word]) {
					delete data.cards[lang][category][word];
					chrome.storage.local.set({"cards": data.cards}, OnError);
				}
	
				event.target.closest(".card").previousElementSibling.remove();
				event.target.closest(".card").remove();
			// add a card
			} else if (event.target.matches('.add')) {
				let newCard = document.createElement("div");
				newCard.className = "card";
				newCard.innerHTML += 
						`<button type="button" class="top-right btn icon-trash-o icon-only" title="Delete Card"></button>
						<div class="double-align input-chunk bot-space">
							<label class="input-label">Word:</label>
							<input type="text" class="word-card right-icon text-input" maxlength="1000">
						</div>
						<div class="double-align input-chunk bot-space">
							<label class="input-label">Romanized:</label>
							<input type="text" class="romanized-card text-input right-icon" maxlength="200">
						</div>
						<div class="double-align input-chunk bot-space">
							<label class="input-label">Def:</label>
							<input type="text" class="def-card text-input right-icon" maxlength="1000">
						</div>
						<button type="button" class="btn" value="confirm">Confirm</button>`;
		
				let header = event.target.closest(".coll-top");
				header.insertAdjacentElement("afterend", newCard);
				header.insertAdjacentElement("afterend", document.createElement("hr"));
			// save an added card
			} else if (event.target.value == "confirm") {
				let parent = event.target.parentElement;
				let category = event.target.closest(".coll-cont").getAttribute("data-name");
				let lang = event.target.closest(".collapsible").id;
	
				let word = parent.querySelector(".word-card");
				let romanized = parent.querySelector(".romanized-card");
				let def = parent.querySelector(".def-card");
	
				if (!word.value || !def.value) {
					alert("Incomplete Card");
					return;
				}
	
				data.cards[lang][category][word.value] = {"def": def.value, "romanized": romanized.value};
				InitSchedule(data.cards[lang][category][word.value]);

				chrome.storage.local.set({"cards": data.cards}, OnError);
				
				word.id = word.value;

				word.setAttribute("save-popup", true);
				romanized.setAttribute("save-popup", true);
				def.setAttribute("save-popup", true);
	
				event.target.remove();
			// show merge popup
			} else if (event.target.matches(".icon-call_merge")) {
				let merge = document.getElementById("popupElement");
				if (merge) {
					merge.remove();
					return;
				}
	
				let category = event.target.value;
				let popup = document.createElement("div");
				let lang = event.target.closest(".collapsible").id;
	
				popup.id = "popupElement";
				popup.innerHTML =
					`<div class="modal-overlay"></div>
					<div class="modal">
						<div class="modal-close">
							<button type="button" id="closePopup" class="icon-close icon-only"></button>
						</div>
						<div class="modal-title">
							<h1 class="modal-header">Merge Categories</h1>
						</div>
						<div class="modal-content">
							<div class="double-align input-chunk">
								<label class="modal-label select-label">Merge:</label>
								<div class="right-icon select-dropdown modal-select">
									<select id="mergeFrom" class="modal-select" disabled>
										<option value="${category}">${category}</option>
									</select>
								</div>
							</div>				      
							<div class="double-align input-chunk">
								<label class="modal-label select-label">Into:</label>
								<div class="right-icon select-dropdown modal-select">
									<select id="mergeTo" class="modal-select"></select>
								</div>
							</div>
							<button type="button" value="${lang}" class="modal-btn btn" id="merge">Merge</button>
						</div>
					</div>`;
	
				let selectFragment = new DocumentFragment();
				for (let name of Object.keys(data.cards[lang])) {
					if (name != category) {
						let option = selectFragment.appendChild(document.createElement('option'));
						option.value = option.text = name;
					}
				}

				popup.querySelector("#mergeTo").appendChild(selectFragment);
				document.querySelector("body").appendChild(popup);
			// move categories
			} else if (event.target.matches("#merge")) {
				let mergeFrom = document.querySelector("#mergeFrom").value;
				let mergeTo = document.querySelector("#mergeTo").value;
				let lang = event.target.value;
	
				data.cards[lang][mergeTo] = Object.assign(data.cards[lang][mergeTo], data.cards[lang][mergeFrom]);
				delete data.cards[lang][mergeFrom];
	
				delete data.categoryNames[lang][mergeFrom];
				chrome.storage.local.set(data, OnError);
	
				let oldCards = document.getElementById(`${lang}_${mergeFrom}`);
				oldCards.children[0].remove();
				document.getElementById(`${lang}_${mergeTo}`).append(...oldCards.children);
				oldCards.parentElement.remove();
	
				let merge = document.getElementById("popupElement");
				merge.remove();
			// change category name
			} else if (event.target.matches(".save-name")) {
				let catElement = event.target.closest(".coll-cont");
				let catName = catElement.getAttribute("data-name");
				let newName = catElement.querySelector(".text-input").value;
				let lang = event.target.closest(".collapsible").id;
	
				if (data.categoryNames[lang][newName]) {
					alert("Name Taken");
					return;
				} else if (!newName) {
					alert("Please Enter a New Category Name");
					return;
				}

				delete data.categoryNames[lang][catName];
				data.categoryNames[lang][newName] = true;
				
				data.cards[lang][newName] = data.cards[lang][catName];
				delete data.cards[lang][catName];
	
				let label = catElement.previousElementSibling;
				label.querySelector(".coll-header").firstChild.nodeValue = newName;
	
				catElement.id = `${lang}_${newName}`;
				catElement.setAttribute("data-name", newName);
				event.target.remove();
	
				chrome.storage.local.set({"categoryNames": data.categoryNames, "cards": data.cards}, OnError);
			// save edits to card
			} else if (event.target.matches(".save-card")) {
				let parent = event.target.parentElement;
				let category = event.target.closest(".coll-cont").getAttribute("data-name");
				let lang = event.target.closest(".collapsible").id;
	
				let word = parent.querySelector(".word-card");
				let romanized = parent.querySelector(".romanized-card");
				let def = parent.querySelector(".def-card");
	
				if (!word.value || !def.value) {
					alert("Incomplete Card");
					return;
				}

				if (word.value != word.id) {
					data.cards[lang][category][word.value] = data.cards[lang][category][word.id];
					delete data.cards[lang][category][word.id];
				}

				data.cards[lang][category][word.value].romanized = romanized.value;
				data.cards[lang][category][word.value].def = def.value;
				word.id = word.value;

				chrome.storage.local.set({"cards": data.cards}, OnError);
	
				event.target.remove();
			// delete category
			} else if (event.target.matches('.icon-trash')) {
				if (confirm("Are you sure you want to delete this category?")) {
					let lang = event.target.closest(".collapsible").id;
	
					if (Object.keys(data.cards[lang]).length === 1 
						&& data.cards[lang][event.target.value]) {
							delete data.cards[lang];
							delete data.categoryNames[lang];
					} else {
						delete data.cards[lang][event.target.value];
						delete data.categoryNames[lang][event.target.value];	
					}

					chrome.storage.local.set(data, OnError);
	
					event.target.closest(".nested-collapsible").remove();
				}
			// show popup to create a category
			} else if (event.target.matches("#addCat")) {
				let pop = document.getElementById("popupElement");
				if (pop) {
					pop.remove();
					return;
				}
	
				let category = event.target.value;
				let popup = document.createElement("div");
	
				popup.id = "popupElement";
				popup.innerHTML =
					`<div class="modal-overlay"></div>
					<div class="modal">
						<div class="modal-close">
							<button type="button" id="closePopup" class="icon-close icon-only"></button>
						</div>
						<div class="modal-title">
							<h1 class="modal-header">Create a Category</h1>
						</div>
						<div class="modal-content">
							<div class="double-align input-chunk" style="margin-bottom: 10px">
								<label class="select-label modal-label">Name:</label>
								<input class="text-input modal-input right-icon" id="catName" type="text" maxlength="100">
							</div>
							<div class="double-align input-chunk">
								<label class="modal-label select-label">Language:</label>
								<div class="select-dropdown modal-select right-icon">
									<select id="langSelect" class="modal-select"></select>
								</div>
							</div>
							<button type="button" class="modal-btn btn" id="createBtn">Create</button>
						</div>
					</div>`;
	
				let selectFragment = new DocumentFragment();
				for (let [code, langName] of Object.entries(langNames)) {
					if (langName != category) {
						let option = selectFragment.appendChild(document.createElement('option'));
						option.value = code;
						option.text = langName;
					}
				}
	
				popup.querySelector("#langSelect").appendChild(selectFragment);
				document.querySelector("body").appendChild(popup);
			// create new category
			} else if (event.target.matches("#createBtn")) {
				let categoryName = document.getElementById("catName").value;
				let lang = document.getElementById("langSelect").value;

				if (!categoryName) {
					alert("Please Specify a Category Name");
					return;
				}

				if (data.categoryNames[lang] && data.categoryNames[lang][categoryName]) {
					alert("Name is taken");
					return;
				} else {
					if (!data.categoryNames[lang])
						data.categoryNames[lang] = {[categoryName]: true};
					else
						data.categoryNames[lang][categoryName] = true;
	
					if (!data.cards[lang])
						data.cards[lang] = {[categoryName]: {}};	
					else
						data.cards[lang][categoryName] = {};
	
					chrome.storage.local.set(data, OnError);
	
					const collapsible = document.createElement("div");
					collapsible.className = "nested-collapsible";
					collapsible.innerHTML = 
						`<input class="coll-input" type="checkbox" id="${UNIQUE_ID}">
						<label class="coll-label" for="${UNIQUE_ID}">
							<h1 class="coll-header header">
								${categoryName}
								<div class="right-icon">
									<button type="button" value="${categoryName}" class="btn icon-call_merge icon-only" title="Merge Category"></button>
									<button type="button" value="${categoryName}" class="btn icon-trash icon-only" title="Delete Category"></button>
								</div>
							</h1>
						</label>`;
					UNIQUE_ID++;

					let category = document.createElement("div");
					category.id = `${lang}_${categoryName}`;
					category.className = "coll-cont";
					category.setAttribute("data-name", categoryName);
					category.innerHTML =
						`<div class="coll-top">
							<div class="card">
								<label>Name:</label>
								<input class="text-input change-cat" type="text" maxlength="100" value="${categoryName}">
							</div>
							<hr>
							<div class="card">
								<button type="button" class="btn add">Add Cards</button>
							</div>
						</div>`;
					collapsible.appendChild(category);
	
					let langColl = document.getElementById(lang);
	
					if (langColl) {
						langColl.querySelector(".coll-cont").appendChild(collapsible);
					} else {
						let p = document.querySelector("p");
						if (p)
							p.remove();
						let langDiv = document.createElement("div");
						langDiv.className = "collapsible";
						langDiv.id = lang;
						langDiv.innerHTML = 
							`<input class="coll-input" type="checkbox" id="${lang}-input">
							<label class="coll-label" for="${lang}-input">
								<h1 class="coll-header header">
									${langNames[lang]}	
									<div class="right-icon">
										<button type="button" value="${lang}" class="btn icon-trash-lang icon-only" title="Remove Category"></button>
									</div>
								</h1>
							</label>

							<div class="coll-cont">
								<div class="spacing"></div>
							</div>`;
						langDiv.querySelector(".coll-cont").appendChild(collapsible);
						document.querySelector("#addCat").insertAdjacentElement("beforebegin", langDiv);
					}
					document.getElementById("popupElement").remove();
				}
			// delete langauge set
			} else if (event.target.matches(".icon-trash-lang")) {
				if (confirm("Are you sure you want to delete this language set?")) {
					let lang = event.target.closest(".collapsible").id;
	
					delete data.categoryNames[lang];
					delete data.cards[event.target.value];
	
					chrome.storage.local.set(data, OnError);
					event.target.closest(".collapsible").remove();
				}
			}
		});
	
		document.addEventListener("change", e => {
			if (e.target.matches(".change-cat")) {
				if (!e.target.parentElement.querySelector(".save-name")) {
					let save = document.createElement("button");
					save.className = "save-name";
					save.textContent = "Save";
	
					e.target.insertAdjacentElement("afterend", save);
				}
			
			} else if (e.target.getAttribute("save-popup")) {
				let card = e.target.closest(".card");
				if (!card.lastElementChild.classList.contains("save-card")) {

					let save = document.createElement("button");
					save.className = "save-card";
					save.textContent = "Save";

					card.appendChild(save);
				}
			}
		});
	}
	// for scheduling (first is front, 2nd is back)
	function InitSchedule(card) {
		card.status = ["learning", "learning"];
		card.steps_index = [0, 0];
		card.ease_factor = [data.sched.startEase || 250, data.sched.startEase || 250];
		card.interval = [null, null];
		card.dueDate = [0, 0];
	}
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

function ShowContent() {
	document.querySelector(".center").remove();

	let container = document.querySelector(".container");
	for (let child of container.children) {
		if (child.nodeName != "script")
			child.style.display = "";
	}
}