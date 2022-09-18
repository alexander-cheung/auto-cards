getStorageData = (key) =>
    new Promise((resolve, reject) =>
    chrome.storage.local.get(key, result =>
        chrome.runtime.lastError
        	? reject(chrome.runtime.lastError.message)
        	: resolve(result)
    ))

// main execution of page
async function Main() {
	ShowLoad();
	let data;

	try {
		data = await getStorageData(["toConfirm", "text", "cards", "categoryNames", "sched", "textLang"]);

		if (!data.sched)
			data.sched = {};
	} catch(e) {
		ShowError(e);
		return;
	}

	Main.easeFactor = data.sched.startEase;
	let langCode;

	if (data.text) {
		if (!data.textLang) {
			langCode = await GetLanguage(data.text);
			langCode = langCode || "en";
			data.textLang = langCode; 
			chrome.storage.local.set({"textLang": data.textLang});
		} else {
			langCode = data.textLang;
		}

		if (!data.toConfirm) {
			if (await ParseText(langCode) === false) {
				return;
			}
		}
	} else {
		langCode = "en";
	}

	if (await RenderContent(langCode) != false);
		SetListeners();

	ShowContent();
}

Main();

async function GetLanguage(text) {
	let body = JSON.stringify({"includePredictions": false, "text": text});
	// get lang code of text
	const options = {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-RapidAPI-Key': 'KEY',
			'X-RapidAPI-Host': 'fast-and-highly-accurate-language-detection.p.rapidapi.com'
		},
		body: body
	};

	let langNames = {};
	let result; let code;

	try {
		let url = chrome.runtime.getURL("static/lang-codes.json");
		let res = await fetch(url);
		langNames = await res.json();

		res = await fetch('https://fast-and-highly-accurate-language-detection.p.rapidapi.com/detect', options);
		code = await res.json();
		result = code;
	} catch(e) {
		console.error(e);
		result = null;
	}

	// unsupported language
	if (result && !langNames[result.lang] && result.prob > 0.5) {
		code = null;
	// query user for lanugage
	} else if (!result || result.prob < 0.5) {
		document.querySelector(".center").remove();
		let popup = document.createElement("div");
		popup.id = "popupElement";
		popup.innerHTML =
			`<div class="modal-overlay"></div>
			<div class="modal">
				<div class="modal-title">
					<h1 class="modal-header">Select Language</h1>
				</div>
				<div class="modal-content">
					<div class="input-chunk">
						<label class="modal-label select-label">Text Language:</label>
						<div class="select-dropdown">
							<select id="langSelect" class="modal-select"></select>
						</div>
					</div>
					<button type="button" class="modal-btn btn" id="confirmLang">Confirm</button>
				</div>
			</div>`;

		let selectFragment = new DocumentFragment();
		for (let [code, langName] of Object.entries(langNames)) {
			let option = selectFragment.appendChild(document.createElement('option'));
			option.value = code;
			option.text = langName;
		}

		popup.querySelector("#langSelect").appendChild(selectFragment);
		popup.querySelector("#langSelect").value = (result && result.lang > 0.1) ? result.lang : "en";
		document.querySelector("body").appendChild(popup);

		try {
			code = await AwaitLanguage();
			ShowLoad();
		} catch(e) {
			console.error(e);
			code = false;
		}
	} else {
		code = result.lang;
	}
	return code;
}

function AwaitLanguage() {
	return new Promise((resolve, reject) => {
		document.getElementById("confirmLang").addEventListener("click", function ClickListener(e) {
			let lang = document.querySelector("#langSelect").value;
			e.target.closest("#popupElement").remove();
			document.removeEventListener("click", ClickListener);
			resolve(lang);
		});
	});
}

// creates flashcards from text
async function ParseText(langFrom) {
	let storage;
	try {
		storage = await getStorageData(["text", "hsk_ban", "cards", "banSets", "settings"]);

		if (!storage.settings)
			storage.settings = {};
		if (!storage.settings.langTo)
			storage.settings.langTo = "en";
		if (!storage.banSets)
			storage.banSets = {};
	} catch (e) {
		ShowError(e);
		return false;
	}

	if (storage.settings.langTo === langFrom) {
		ShowError("The target language matches the source language. Please translate between two different languages.");
		chrome.storage.local.remove("text");
		return false;
	}

	let segmentLangs = ["ja", "lo", "th", "my", "km", "vi"]; // zh
	let cards;

	// make banList
	let banList = storage.banSets[langFrom] ? storage.banSets[langFrom] : {};

	if (storage.cards && storage.cards[langFrom]) {
		for (var category of Object.values(storage.cards[langFrom])) {
			for (key of Object.keys(category)) {
				banList[key] = true;
			}
		}
	}

	if (langFrom === "zh") {
		if (storage.hsk_ban) {
			lists = [];
			for (let i = 0; i < 6; i++) {
				if (storage.hsk_ban[i]) {
					lists.push(i+1);
				}
			}
			try {
				// must specifically select false
				let getTrad = storage.settings.zhOption === false ? true : false;
				console.log(getTrad);
				res = await fetch(`https://zh-en-dict.vercel.app/api/HSK?combine=true&trad=${getTrad}&lists=${JSON.stringify(lists)}`);
			} catch (e) {
				ShowError(e);
				return false;
			}

			if (res === "Error: Invalid Input" || res === "Parsing Error") {
				ShowError(res);
				return false;
			}

			banList = Object.assign(banList, await res.json());
		}
		
		let tradKey;
		if (storage.settings.zhOption === false) {
			let cards; let ban;

			try {
				[cards, tradKey] = await zhMakeCards(storage.text, storage.settings.langTo, true);
				ban = await ConvertTrad(Object.keys(banList));
			} catch (e) {
				ShowError(e);
				return false;
			}

			banList = {};

			for (let word of ban) {
				banList[word] = true;
			}

			if (banList["几"])
				banList["幾"] = true;

			let toConfirm = {"toKeep": {}, "toBlock": {}};

			for (const [word, card] of Object.entries(cards)) {
				if (banList[tradKey[word]]) {
					toConfirm.toBlock[word] = card;
				} else {
					toConfirm.toKeep[word] = card;
				}
			}

			chrome.storage.local.set({"toConfirm": toConfirm}, OnError);

		} else {
			try {
				cards = await zhMakeCards(storage.text, storage.settings.langTo);
			} catch (e) {
				ShowError(e);
				return false;
			}

			let toConfirm = {"toKeep": {}, "toBlock": {}};

			for (const [word, card] of Object.entries(cards)) {
				if (banList[word]) {
					toConfirm.toBlock[word] = card;
				} else {
					toConfirm.toKeep[word] = card;
				}
			}

			chrome.storage.local.set({"toConfirm": toConfirm}, OnError);

		}
	} else {
		let wordSet;
		const regex = new RegExp(/[\p{P}\p{Z}]/u);

		// (`https://nlp.yeu.ai/api/v1/tok?text=${filterPunctuation(storage.text)}`)
		if (segmentLangs.includes(langFrom)) {
			wordSet = new Set();
			let it = Intl.v8BreakIterator([langFrom], {type:'word'});
			it.adoptText(storage.text);

			let cur = 0;
			let prev = 0;

			while (cur < storage.text.length) {
				prev = cur;
				cur = it.next();
				let word = storage.text.substring(prev, cur);
				if (!regex.test(word))
					wordSet.add(word);
			}

		} else {
			wordSet = new Set(storage.text.split(/[\p{P}\p{Z}]+/gu));
		}
		wordSet.delete("");
		let words = [];
		wordSet.forEach(word => words.push(word));

		let defs = await getDefs(words, langFrom, storage.settings.langTo);
		let transliteration = await transliterate(words, langFrom);
		cards = makeCards(words, defs, transliteration);

		if (!cards) {
			ShowError("No Words Found");
			return false;
		}

		let toConfirm = {"toKeep": {}, "toBlock": {}};

		for (const [word, card] of Object.entries(cards)) {
			if (banList[word]) {
				toConfirm.toBlock[word] = card;
			} else {
				toConfirm.toKeep[word] = card;
			}
		}

		chrome.storage.local.set({"toConfirm": toConfirm}, OnError);
	}
}

// convert simplified to traditional text, separates into mult req if needed
async function ConvertTrad(words) {
	let textStr = ""; const MAX_LENGTH = 4600; let texts = [];

	// if text too big split into pieces
	for (let word of words) {
		if (textStr.length + 1 + word.length <= MAX_LENGTH)
			textStr += word + " ";
		else {
			texts.push(textStr);
			textStr = word + " ";
		}
	}
	texts.push(textStr);
	let result = [];

	// fetch and combine for each piece
	try {
		for (let text of texts) {
			let res = await fetch("https://zh-en-dict.vercel.app/api/conv?text=" + text.trimEnd());

			if (!res.ok)
				throw new Error(await res.text());
			res = await res.json();

			result.push(...res.split(" "));
		}
	} catch (e) {
		throw e;
	}

	return result;
}

// segment chinese text, separates into mult req if needed
async function SegmentText(text) {
	const MAX_LENGTH = 3750; let parts = [];

	// just one req
	if (text.length <= MAX_LENGTH) {
		parts = [text];
	}
	
	while (text.length > MAX_LENGTH) {
		parts.push(text.substring(0, MAX_LENGTH));
		text = text.substring(MAX_LENGTH);
	}

	let words = new Set();

	try {
		await Promise.all(parts.map(async portion => {
			let res = await fetch("https://segment-api-bluelovers.vercel.app/?input=" + portion);

			if (!res.ok)
				throw new Error(await res.text());
			
			res = await res.json();
			
			if (res.error)
				throw new Error(res.message);

			res.results[0].forEach(phrase => words.add(phrase.ow ? phrase.ow : phrase.w));
		}));
	} catch(e) {
		throw e;
	}

	let arr = [];
	words.delete(" ");
	words.forEach(card => arr.push(card));

	if (!arr.length)
		throw new Error("No Cards Found");

	return arr;
}

// get chinese defs in english, separates into mult req if needed
async function ChineseDefs(arr) {
	let defQuery = "["; let queries = []; const MAX_LENGTH = 4900; let defs = [];
	for (let word of arr) {
		if (defQuery.length + word.length + 3 < MAX_LENGTH)
			defQuery += `"${word}",`;
		else {
			defQuery = defQuery.slice(0, -1) + "]";
			queries.push(defQuery);
			defQuery = `["${word}",`;
		}
	}
	
	defQuery = defQuery.slice(0, -1) + "]";
	queries.push(defQuery);

	// get definition with pinyin
	try {
		for (let query of queries) {
			res = await fetch(`https://zh-en-dict.vercel.app/api/translate?pinyin=true&words=${query}`);
		
			if (!res.ok)
				throw new Error(await res.text());

			res = await res.json();

			if (res === "Parsing Error")
				throw new Error(res);

			defs.push(...res);
		}
	} catch (e) {
		throw e;
	}

	return defs;
}

async function zhMakeCards(text, langTo, makeTrad, transliterate) {
	// segment text, no duplicates
	let res; let words; let needDef;
	let cards = {}; let trad; let tradKey = {};
	
	try {
		words = await SegmentText(text);

		if (makeTrad || transliterate) {
			trad = await ConvertTrad(words);

			for (let i = 0; i < words.length; i++) {
				tradKey[words[i]] = trad[i];
			}
		}
	} catch(e) {
		console.error(e);
		throw e;
	}

	if (langTo === "en") {
		needDef = []; let defs;

		// get definition with pinyin
		try {
			defs = await ChineseDefs(words);
		} catch (e) {
			console.error(e);
			throw e;
		}

		// get cards that need a def
		for (let i = defs.length - 1; i >= 0; i--) {
			if (defs[i]) {
				if (defs[i].def && defs[i].pinyin) {
					cards[words[i]] = {"def": defs[i].def, "romanized": defs[i].pinyin};
				} else if (defs[i].pinyin) {
					cards[words[i]] = {"romanized": defs[i].pinyin};
					needDef.push(words[i]);
				}
			}
		}

		if (needDef.length) {
			let moreDefs = await getDefs(needDef, "zh", langTo);

			if (moreDefs) {
				for (let i = 0; i < moreDefs.length; i++) {
					let start = moreDefs[i].indexOf("[") + 1;
					let end = moreDefs[i].indexOf("]");

					if (start < 0 || end < 0) {
						cards[needDef[i]].def = moreDefs[i];
					} else {
						let def = moreDefs[i].substring(start, end);
						if (needDef[i] != def)
							cards[needDef[i]].def = def;
					}
				}
			}
		}
	} else {
		let defs = await getDefs(words, "zh", langTo);
		if (!defs)
			defs = {};

		let romanized = {};
		if (transliterate) {
			romanized = await transliterate(words, "zh-Hant");
		}

		let zhRegex = new RegExp(/\p{sc=Han}/u);
		for (let i = 0; i < words.length; i++) {
			cards[words[i]] = {};
			
			if (defs[i]) {
				let front = defs[i].indexOf("[") + 1;
				let back = defs[i].indexOf("]");

				if (front < 0 || back < 0) {
					cards[words[i]].def = defs[i];
				} else {
					let def = defs[i].substring(front, back);
					if (words[i] !== def && zhRegex.test(words[i]))
						cards[words[i]].def = def;
				}
			}

			if (romanized[i])
				cards[words[i]].romanized = romanized[i];
		}
	}

	if (makeTrad)
		return [cards, tradKey];
	else
		return cards;
}

async function getDefs(cards, langFrom, langTo) {
	let from = langFrom || "auto";
	
	let body = JSON.stringify(cards.map(card => {
		return {"from": from, "to": langTo, "text": card};
	}));

	const options = {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-RapidAPI-Key': 'KEY',
			'X-RapidAPI-Host': 'translo.p.rapidapi.com'
		},
		body: body
	};

	try {
		res = await fetch('https://translo.p.rapidapi.com/api/v3/batch_translate', options);
		let defs = await res.json();

		if (defs.ok) {
			return defs.batch_translations.map(def => def.text);
		} else {
			return undefined;
		}
	} catch (e) {
		console.error(e);
		return undefined;
	}
}

async function transliterate(cards, langFrom) {
	const options = {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-RapidAPI-Key': 'KEY',
			'X-RapidAPI-Host': 'microsoft-translator-text.p.rapidapi.com'
		},
		body: `[{"Text":"${cards.join(" ")}"}]`
	};
	let url = chrome.runtime.getURL("static/transliterate.json");

	try {
		let res = await fetch(url);
		let scriptCodes = await res.json();

		// language romanization not supported
		if (!scriptCodes[langFrom])
			return undefined;

		res = await fetch(`https://microsoft-translator-text.p.rapidapi.com/transliterate?api-version=3.0&toScript=latn&fromScript=${scriptCodes[langFrom]}&language=${langFrom}`, options)

		let romanized = await res.json();
		return romanized[0].text.split(" ");
	} catch(e) {
		console.error(e);
		return undefined;
	}
}

function makeCards(words, defs = [], transliteration = []) {
	let cards = {};

	for (let i = 0; i < words.length; i++) {
		cards[words[i]] = {};
		if (defs[i]) {
			let start = defs[i].indexOf("[") + 1;
			let end = defs[i].lastIndexOf("]");
			if (start < 0 || end < 0) {
				cards[words[i]].def = defs[i];
			} else {
				let def = defs[i].substring(start, end);
				if (words[i] != def)
					cards[words[i]].def = def;
			}
		}
		if (transliteration[i]) {
			cards[words[i]].romanized = transliteration[i];
		}
	}
	return cards;
}

function filterPunctuation(text) {
	if (typeof text === "string") {
		return text.replace(/[\p{P}]/gu, " ").replace(/\s{2,}/g, ' ');
	} else {
		return null;
	}
}

async function RenderContent(lang) {
	let data; let langNames = {};

	try {
		data = await getStorageData(["toConfirm", "categoryNames", "cards"]);

		if (!data.toConfirm)
			data.toConfirm = {};

		let url = chrome.runtime.getURL("static/lang-codes.json");
		let res = await fetch(url);
		langNames = await res.json();

	} catch(e) {
		ShowError(e);
		return false;
	}

	let langOptions = new DocumentFragment();

	for (let [code, langName] of Object.entries(langNames)) {
		let option = langOptions.appendChild(document.createElement('option'));
		option.value = code;
		option.text = langName;
	}

	let langSelect = document.getElementById("lang");

	if (langSelect) {
		langSelect.appendChild(langOptions);
		langSelect.value = lang;
	}

	let keepList = document.getElementById("toKeep");
	let banList = document.getElementById("toBlock");

	let catSelect = document.getElementById("addToCat");

	if (data.cards && data.cards[lang]) {
		let selectFragment = new DocumentFragment();

		for (let name of Object.keys(data.cards[lang])) {
		    let option = selectFragment.appendChild(document.createElement('option'));
        	option.value = option.text = name;
		}

		if (catSelect)
			catSelect.appendChild(selectFragment);
	}

	let cardSet = new DocumentFragment();
	if (data.toConfirm.toKeep) {
		for (const [key, value] of Object.entries(data.toConfirm.toKeep)) {
			// doc fragment to add new html to
			cardSet.appendChild(document.createElement("hr"));
			// init card
			let newCard = document.createElement("div");
			newCard.className = "card";
			let romanized = value.romanized ? value.romanized : "";
			let def = value.def ? value.def : "";

			// add to card then fragment and insert in dom
			newCard.innerHTML += 
				`<button type=button" class="error top-right btn icon-ban icon-only left-adjust" title="Block Word"></button>
				<div class="double-align bot-space">
					<label class="card-label">Word:</label>
					<input type="text" class="word text-input right-icon" value="${key}" maxlength="1000">
				</div>
				<div class="double-align bot-space">
					<label class="card-label">Romanized:</label>
					<input type="text" class="romanized text-input right-icon" value="${romanized}" maxlength="200">
				</div>
				<div class="double-align">
					<label class="card-label">Def:</label>
					<input type="text" class="def text-input right-icon" value="${def}" maxlength="1000">
				</div>`;
				

			cardSet.appendChild(newCard);
		}

		keepList.appendChild(cardSet);
	}

	let banSet = new DocumentFragment();

	if (!data.toConfirm.toBlock) {
		return;
	}

	for (const [key, value] of Object.entries(data.toConfirm.toBlock)) {
		// doc fragment to add new html to
		banSet.appendChild(document.createElement("hr"));
		// init card
		let newCard = document.createElement("div");
		newCard.className = "card";
		let romanized = value.romanized ? value.romanized : "";
		let def = value.def ? value.def : "";

		// add to card then fragment and insert in dom
		newCard.innerHTML += 
			`<button type="button" class="error top-right left-adjust btn icon-remove icon-only" title="Unblock Word"></button>
			<div class="input-chunk double-align bot-space">
				<label class="card-label">Word:</label>
				<input type="text" class="word text-input right-icon" value="${key}" maxlength="1000">
			</div>
			<div class="input-chunk double-align bot-space">
				<label class="card-label">Romanized:</label>
				<input type="text" class="romanized text-input right-icon" value="${romanized}" maxlength="200">
			</div>
			<div class="input-chunk double-align">
				<label class="card-label">Def:</label>
				<input type="text" class="def text-input right-icon" value="${def}" maxlength="1000">
			</div>`;

		// add to card then fragment and insert in dom
		banSet.appendChild(newCard);
	}

	banList.appendChild(banSet);
}

function SetListeners() {
	let lang = document.getElementById("lang");
	let confirm = document.getElementById("confirm");

	if (!lang || !confirm)
		return;

	let keepList = document.getElementById("toKeep");
	let banList = document.getElementById("toBlock");

	for (let btn of document.querySelectorAll('.icon-remove, .icon-ban')) {
		btn.addEventListener('click', e => {
		    if (e.target.closest("#toKeep")) {
				e.target.classList.replace("icon-ban", "icon-remove");
				e.target.setAttribute("title", "Unblock Word");

				banList.appendChild(e.target.parentElement.previousSibling);
		        banList.appendChild(e.target.parentElement);
		   	} else {
				e.target.classList.replace("icon-remove", "icon-ban");
				e.target.setAttribute("title", "Block Word");

		    	keepList.appendChild(e.target.parentElement.previousSibling);
		    	keepList.appendChild(e.target.parentElement);
		    }
		});
    }

	chrome.storage.onChanged.addListener(function (changes, namespace) {
		let lang = document.getElementById("lang");
		if (!lang)
			return;

		lang = lang.value;

		for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
			if (key != "categoryNames")
				continue;

			oldValue = oldValue || {};
			newValue = newValue || {};

			let newArr = newValue[lang] ? Object.keys(newValue[lang]) : [];
			let oldArr = oldValue[lang] ? Object.keys(oldValue[lang]) : [];

			if (!oldArr.length || !newArr.length || !oldArr.every((val, idx) => val === newArr[idx])) {
				let catSelect = document.getElementById("addToCat");
				let selectFragment = new DocumentFragment();
			
				let infoOpt = document.createElement("option");
				infoOpt.textContent = "Add to an existing category";
				
				let none = document.createElement("option");
				none.textContent = "None";

				none.value = infoOpt.value = "Default";

				selectFragment.appendChild(infoOpt);
				selectFragment.appendChild(none);

				for (let name of newArr) {
					let option = selectFragment.appendChild(document.createElement('option'));
					option.value = option.text = name;
				}

				catSelect.replaceChildren(selectFragment);
				catSelect.value = "Default";
				break;
			}
		}
	});

	lang.addEventListener("change", async function(e) {
		let data;
		try {
			data = await getStorageData(["categoryNames", "textLang"]);
		} catch(e) {
			ShowError(e);
			return;
		}

		let newLang = e.target.value;
		let catSelect = document.getElementById("addToCat");
		let selectFragment = new DocumentFragment();
	
		let infoOpt = document.createElement("option");
		infoOpt.textContent = "Add to an existing category";
		
		let none = document.createElement("option");
		none.textContent = "None";

		none.value = infoOpt.value = "Default";

		selectFragment.appendChild(infoOpt);
		selectFragment.appendChild(none);

		if (data.categoryNames && data.categoryNames[newLang]) {
			for (let name of Object.keys(data.categoryNames[newLang])) {
				let option = selectFragment.appendChild(document.createElement('option'));
				option.value = option.text = name;
			}
		}

		catSelect.replaceChildren(selectFragment);
		catSelect.value = "Default";

		chrome.storage.local.set({"textLang": newLang});
	});

	confirm.addEventListener("click", async function() {
		let data;
		try {
			data = await getStorageData(["cards", "categoryNames", "banSets", "toConfirm"]);
		} catch(e) {
			ShowError(e);
			return;
		}

		let name = document.getElementById("ctgName");
		let oldCatSelect = document.getElementById("addToCat");
		let lang = document.getElementById("lang").value;

		if (!data.cards)
			data.cards = {};

		if (!name.value && oldCatSelect.value == "Default") {
			alert("Please Specify a New/Old Category Name");
			return;
		} else if (data.cards[lang] && data.cards[lang][name.value]) {
			alert("Category Name Taken");
			return;
		} else if (name.value && oldCatSelect.value != "Default") {
			alert("Please Only Select One Category Option");
			return;
		}

		let cardSet = {};
		let newBanSets = data.banSets ? data.banSets: {};
		if (!newBanSets[lang])
			newBanSets[lang] = {};

		let front = document.querySelectorAll('.word');
		let romanized = document.querySelectorAll('.romanized');
		let back = document.querySelectorAll('.def');

		for (let i = 0; i < front.length; i++) {
			if (front[i].value ? !back[i].value : back[i].value) {
				alert(`Incomplete Field`);
				return;
			} else if (data.toConfirm.toKeep[front[i].value] && front[i].closest("#toBlock")) {
				newBanSets[lang][front[i].value] = true;
			} else if (front[i].closest("#toKeep")) {
				cardSet[front[i].value] = {"def": back[i].value, "romanized": (romanized[i] ? romanized[i].value : null)};
				InitSchedule(cardSet[front[i].value]);
			}
		}

		let newCards = data.cards ? data.cards : {};
		let newCats = data.categoryNames ? data.categoryNames : {};

		if (name.value) {
			if (newCats[lang])
				newCats[lang][name.value] = true;
			else
				newCats[lang] = {[name.value]: true};

			if (newCards[lang])
				newCards[lang][name.value] = cardSet;
			else
				newCards[lang] = {[name.value]: cardSet};
		} else {
			newCards[lang][oldCatSelect.value] = Object.assign(newCards[lang][oldCatSelect.value], cardSet);
		}

		chrome.storage.local.set({"categoryNames": newCats, "cards": newCards, "banSets": newBanSets}, () => {
			if (chrome.runtime.lastError) {
				ShowError(chrome.runtime.lastError.message);
				return;
			} else {
				chrome.storage.local.remove(["toConfirm", "text", "textLang"]);
		
				let msg = document.createElement("div");
				msg.className = "center-msg";
				msg.innerHTML =
					`<div>Success</div>
					<div>Cards successfully created. To access them, click on the extension through the puzzle icon in the top right hand corner.</div>`;
		
				let container = document.querySelector(".container");
				container.replaceChildren(msg);
				container.classList.add("center", "full-page");
			}
		});
	});
}

function ShowLoad() {
	document.querySelector(".container").style.display = "none";

	let center = document.createElement("div");
	center.className = "center full-page";
	center.innerHTML = `<div class="loader"></div>`;
	document.querySelector("body").appendChild(center);
}

function ShowContent() {
	let center = document.querySelector(".center");
	if (center)
		center.remove();

	document.querySelector(".container").style = "";
}

function ShowError(text) {
	let load = document.querySelector(".center")
	if (load)
		load.remove();

	let msg = document.createElement("div");
	msg.className = "center-msg";
	msg.innerHTML =
		`<div>Error</div>
		<div>${text}</div>`;

	let container = document.querySelector(".container");
	container.replaceChildren(msg);
	container.classList.add("center", "full-page");
	container.style = "";
}

// for scheduling (first is front, 2nd is back)
function InitSchedule(card) {
    card.status = ["learning", "learning"];
    card.steps_index = [0, 0];
    card.ease_factor = [Main.easeFactor || 250, Main.easeFactor || 250];
    card.interval = [null, null];
    card.dueDate = [0, 0];
}

function OnError() {
	if (chrome.runtime.lastError)
		ShowError(chrome.runtime.lastError.message);
}