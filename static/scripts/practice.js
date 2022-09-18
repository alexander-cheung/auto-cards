Main();

async function Main() {
    let page = document.querySelector("body").getAttribute("data-page");
    let data;
        
    try {
        data = await getStorageData(["settings", "pConfig", "cards", "sched"]);

        if (!data.cards) {
            ShowMsg(page === "menu" ? "Cards due for studying will be shown here." : "No Cards Found");
            return;
        }
        if (!data.sched)
            data.sched = {};
    } catch (e) {
        ShowError(e);
        return;
    }

    Main.storageCards = data.cards;

    if (page == "menu") {
        if (!data.settings)
            data.settings = {};
        if (!data.settings.dailyMax)
            data.settings.dailyMax = 30;
        if (!data.settings.dailyMode)
            data.settings.dailyMode = "front";

        Main.cardsList = getCards("all");

        RenderPractice(data.settings.dailyMax, data.settings.dailyMode, false);
        OnSessionComplete([data.settings.dailyMax, data.settings.dailyMode, false]);
    
    } else {
        chrome.storage.local.remove("pConfig");

        if (!data.pConfig || !data.pConfig.mode ||
            !data.pConfig.cardAmt || !data.pConfig.categories) {
                ShowError("Internal Error");
                return;
        }

        Main.cardsList = getCards(data.pConfig.categories);

        RenderPractice(data.pConfig.cardAmt, data.pConfig.mode, !data.pConfig.studyDue);
        OnSessionComplete([data.pConfig.cardAmt, data.pConfig.mode, true]);
    }

    if (!Object.keys(Main.cardsList).length) {
        let msg = "Cards due for studying will be shown here.";
        if (page === "practice") {
            if (data.pConfig.studyDue)
                msg = "No Due Cards Found";
            else 
                msg = "No Cards Found";
        }
    
        ShowMsg(msg);
        return;
    }

    Main.badActions = 0;
    Main.actionLimit = 5;
    Main.current = document.getElementById("1");
    RegisterInput();

    Main.sched = {
        "NEW_STEPS": [1, 10],
        "GRADUATING_INTERVAL": data.sched.gradInt || 1,
        "EASY_INTERVAL": data.sched.easyInt || 4,
        "EASY_BONUS": data.sched.easyBonus || 130,
        "INTERVAL_MODIFIER": data.sched.intMod || 100,
        "MINIMUM_INTERVAL": 1,
        "NEW_INTERVAL": data.sched.newInt || 70,
        "LAPSES_STEPS": [10, 10],
        "MAXIMUM_INTERVAL": 36500,
        "HARD_MULTIPLIER": data.sched.hardInt || 120
    };
}

function getCards(categories) {
    let cards = {};

    if (categories === "all") {
        for (let lang in Main.storageCards) {
            for (let category of Object.values(Main.storageCards[lang])) {
                cards = {...cards, ...category};
            }
        }
    } else {
        for (let lang in categories) {
            for (let category in categories[lang]) {
                cards = {...cards, ...Main.storageCards[lang][category]};
            }
        }
    }

    return cards;
}

function RenderPractice(maxCards, cardMode, practiceAll) {
    let cardAmt = 0;
    if (maxCards === "all")
        maxCards = Number.MAX_VALUE;

    let now = Date.now();

    let cardsHTML = document.createElement("div");

    for (let [name, card] of Object.entries(Main.cardsList)) {
        let toPractice = practiceAll || !card.dueDate[0] || now > card.dueDate[0];

        if ((cardMode === "front" || cardMode === "both") && toPractice) {
            let back = card.romanized ? `(${card.romanized}) ${card.def}` : card.def;
            
            let frontFont = GetFont(name);
            let backFont = GetFont(back);
            cardsHTML.innerHTML += 
                `<div class="practice-content hide" data-card="${name}" data-side="front">
                    <div class="practice-front ${frontFont}">${name}</div>
                    <div class="practice-back flipped ${backFont}">${back}</div>
                </div>`;
            cardAmt++;
        }

        if (cardAmt >= maxCards)
            break;

        toPractice = practiceAll || !card.dueDate[1] || now > card.dueDate[1];

        if ((cardMode === "back" || cardMode === "both") && toPractice) {

            let back = card.romanized ? `${name} (${card.romanized})` : name;

            let frontFont = GetFont(card.def);
            let backFont = GetFont(back);
            cardsHTML.innerHTML += 
                `<div class="practice-content hide" data-card="${name}" data-side="back">
                    <div class="practice-front ${frontFont}">${card.def}</div>
                    <div class="practice-back flipped ${backFont}">${back}</div>
                </div>`;
            cardAmt++;
        }

        if (cardAmt >= maxCards)
            break;
    }

    if (!cardAmt) {
        let page = document.querySelector("body").getAttribute("data-page");
        let err = page === "menu" ? "Cards due for studying will be shown here." : "No Due Cards Found";
        ShowMsg(err);
        return;
    }

    // shuffle elements (not >= 0, last element will be first element shuffled)
    let ID_COUNTER = 1;

    for (let i = cardsHTML.children.length; i > 0; i--) {
        let node = cardsHTML.children[Math.random() * i | 0];
        node.id = ID_COUNTER++;
        cardsHTML.appendChild(node);
    }

    cardsHTML.querySelector(".practice-content").classList.replace("hide", "show");
    cardsHTML.innerHTML += 
        `<div class="practice-content hide" id="${ID_COUNTER++}">
            <div class="practice-front">
                <div>Practice Complete</div>
                <button id="again">Practice Again</button>
            </div>
        </div>
        <div class="caption">
            <div class="card-number">1 / ${cardAmt}</div>
            <div class="hide card-options">
            </div>
        </div>
        <div class="disabled prev icon-caret-left"></div>
		<div class="disabled next icon-caret-right"></div>`;

    Main.cardAmt = cardAmt;
    document.querySelector(".practice-terminal").appendChild(cardsHTML);
}

function GetFont(text) {
    if (text.length < 190)
        return "";
    else if (text.length <= 300)
        return "card-l";
    else if (text.length <= 500)
        return "card-xl";
    else if (text.length <= 1000)
        return "card-xxl";
}

function RegisterInput() {
    let nextCheck = 1;

    document.addEventListener("click", async function(e) { 
        let currentID = parseInt(Main.current.id);
        let caption = WhichCaption(); let change;

		if (e.target.matches(".practice-front, .practice-back")) {
            let flip = FlipCard();

            // flip new card = ask for feedback on card
            if (flip && nextCheck == currentID && caption == "number") {
                let card = Main.cardsList[Main.current.getAttribute("data-card")];
                let times = getTimes(card, Main.current.getAttribute("data-side"));
                Main.times = times;
                showTimes(times);
                ToggleFeedback();
            }

		} else if (e.target.matches(".icon-caret-left")) {
			change = ChangeCard("ArrowLeft");
            if (document.querySelector(".card-options") && caption === "feedback" && change)
                ToggleFeedback();

		} else if (e.target.matches(".icon-caret-right") && currentID < nextCheck) {
			change = ChangeCard("ArrowRight");

		} else if (e.target.matches(".card-option")) {
            ToggleFeedback();

            let card = Main.cardsList[Main.current.getAttribute("data-card")];
            let side = Main.current.getAttribute("data-side");
            let index = Main.current.getAttribute("data-index");
            
            schedule(card, e.target.getAttribute("data-option"), side);

            if (side === "front") {
                card.dueDate[0] = Main.times[index] + Date.now();
            } else if (side === "back") {
                card.dueDate[1] = Main.times[index] + Date.now();
            } else {
                ShowError("Scheduling Error");
                return;
            }

            nextCheck++;
            change = ChangeCard("ArrowRight");
            chrome.storage.local.set({"cards": Main.storageCards}, OnError);

        } else if (e.target.matches("#again")) {
            nextCheck = 1;

            document.querySelector(".practice-terminal").replaceChildren();
            RenderPractice(...OnSessionComplete.params);

            Main.current = document.getElementById("1");
            change = 1;
        }
        currentID = change ? change : currentID;

        // dont allow user to skip feedback for a card
        if (nextCheck == currentID) {
            document.querySelector(".icon-caret-right").classList.add("disabled");
        } else {
            document.querySelector(".icon-caret-right").classList.remove("disabled");
        }

        if (currentID == 1)
            document.querySelector(".icon-caret-left").classList.add("disabled");
        else
            document.querySelector(".icon-caret-left").classList.remove("disabled");
	});

	document.addEventListener('keyup', e => {
        let currentID = Main.current.id;
        let keys = {"1": "fail", "2": "hard", "3": "good", "4": "easy"};
        let caption = WhichCaption(); let change;
        let omit = ["Enter", "Tab", "Shift", "Escape", "Meta", "Alt", "Control"];

		if (e.code === 'Space') {
            let flip = FlipCard();

            // flip new card = ask for + handle feedback
            if (flip && nextCheck == currentID && caption == "number") {
                let card = Main.cardsList[Main.current.getAttribute("data-card")];
                let times = getTimes(card, Main.current.getAttribute("data-side"));
                Main.times = times;
                showTimes(times);
                ToggleFeedback();
            }

		} else if (e.code === "ArrowLeft") {
			change = ChangeCard(e.code);
            if (document.querySelector(".card-options") && caption === "feedback" && change)
                ToggleFeedback();

		} else if (e.code === "ArrowRight" && currentID < nextCheck) {
            change = ChangeCard(e.code);
        
        } else if (keys[e.key] && caption === "feedback") {
            ToggleFeedback();

            let card = Main.cardsList[Main.current.getAttribute("data-card")];
            let side = Main.current.getAttribute("data-side");
            let index = parseInt(e.key) - 1;

            schedule(card, keys[e.key], side);

            if (side === "front") {
                card.dueDate[0] = Main.times[index] + Date.now();
            } else if (side === "back") {
                card.dueDate[1] = Main.times[index] + Date.now();
            } else {
                ShowError("Scheduling Error");
                return;
            }
            
            chrome.storage.local.set({"cards": Main.storageCards}, OnError);

            change = ChangeCard("ArrowRight");
            nextCheck++;

        } else if (!omit.includes(e.key)) {
            Main.badActions++;
            if (Main.badActions >= Main.actionLimit)
                ShowMessage("Press Space to Flip");
        }
        currentID = change ? change : currentID;

        if (nextCheck == currentID) 
            document.querySelector(".icon-caret-right").classList.add("disabled");
        else 
            document.querySelector(".icon-caret-right").classList.remove("disabled");
        
        if (currentID == 1)
            document.querySelector(".icon-caret-left").classList.add("disabled");
        else
            document.querySelector(".icon-caret-left").classList.remove("disabled");
	});
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

function OnSessionComplete(params) {
    OnSessionComplete.params = params;
}

function FlipCard() {
	let card = document.querySelector(".practice-content.show");
	
	let back = card.querySelector(".practice-back")
    if (back)
        back.classList.toggle("flipped");
    else
        return false;

    let front = card.querySelector(".practice-front")
    if (front)
        front.classList.toggle("flipped");
    else
        return false;

    return true;
}

function ChangeCard(key) {
	let number = parseInt(Main.current.id);

    let caption = document.querySelector(".card-number");
    let total = Main.cardAmt;

	if (key === "ArrowLeft") {
		let previous = document.getElementById(`${number - 1}`);

		if (previous) {
			previous.classList.remove("hide", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
			Main.current.classList.remove("show", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
			
			previous.classList.add("show", "slide-in-left");
			Main.current.classList.add("slide-out-right");

            caption.textContent = (number - 1) <= total ? `${number - 1} / ${total}`: "";
            Main.current = previous;
            return number - 1;
        }
	} else if (key === "ArrowRight") {
		let next = document.getElementById(`${number + 1}`);

		if (next) {
			next.classList.remove("hide", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
			Main.current.classList.remove("show", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");

			next.classList.add("show", "slide-in-right");
			Main.current.classList.add("slide-out-left");

            caption.textContent = (number + 1) <= total ? `${number + 1} / ${total}`: "";
            Main.current = next;
            return number + 1;
		}
	}
    // fail to change
    Main.badActions++;
    if (Main.badActions >= Main.actionLimit)
        ShowMessage("Press Space to Flip");

    return false;
}

function ToggleFeedback() {
    document.querySelector(".card-options").classList.toggle("hide");
    document.querySelector(".card-number").classList.toggle("hide");
}

function WhichCaption() {
    if (document.querySelector(".card-number").classList.contains("hide")) 
        return "feedback";
    else
        return "number";
}

function ShowMessage(text) {
    if (document.getElementById("message") || Main.msgFlag)
        return;

    Main.msgFlag = true;

    let msg = document.createElement("div");
    msg.id = "message";
    msg.className = "warning message";

    msg.innerHTML += 
        `<button id="msgClose" class="warning icon-close" type="button" title="Close"></button>
        <div>${text}</div>`;

    msg.querySelector("#msgClose").addEventListener("click", e => {
        document.getElementById("message").remove();
    });

    document.querySelector(".practice-terminal").appendChild(msg);
}

function ShowError(text) {
	let msg = document.createElement("div");
    msg.className = "center-msg";
    
	msg.innerHTML +=
		`<div>Error</div>
        <div>${text}</div>`;

	let container = document.querySelector(".practice-terminal");
	container.replaceChildren(msg);
	container.classList.add("center");
}

function ShowMsg(text) {
    let msg = document.createElement("div");
    
	msg.innerHTML +=
		`<div class="info-msg">${text}</div>`;

	let container = document.querySelector(".practice-terminal");
	container.replaceChildren(msg);
	container.classList.add("center");
}

function OnError() {
	if (chrome.runtime.lastError)
		ShowError(chrome.runtime.lastError.message);
}

// based off anki's scheduling algorithm and riceissa's interpretation at 
// https://gist.github.com/riceissa/1ead1b9881ffbb48793565ce69d7dbdd

// sets interval, ease factor, status for a card
function schedule(card, response, side) {
    let index = side === "front" ? 0 : 1;
    
    // card isn't actually due yet
    if (card.dueDate[index] > Date.now()) {
        return;
    }

    if (card.status[index] === "learning") {
        if (response === "fail") {
            card.steps_index[index] = 0;

        } else if (response === "hard") {
            card.steps_index[index] = 0;

        } else if (response === "good") {
            card.steps_index[index] += 1;

            if (card.steps_index[index] >= Main.sched.NEW_STEPS.length) {
                // we have graduated!
                card.status[index] = 'learned';
                card.interval[index] = Main.sched.GRADUATING_INTERVAL;
            }

        } else if (response === "easy") {
            card.status[index] = "learned";
            card.interval[index] = Main.sched.EASY_INTERVAL;
        }

    } else if (card.status[index] === "learned") {
        if (response === "fail") {
            card.status[index] = "relearning";
            card.steps_index[index] = 0;
            card.ease_factor[index] = Math.max(130, card.ease_factor[index] - 20);
            card.interval[index] = Math.max(Main.sched.MINIMUM_INTERVAL, card.interval[index] * Main.sched.NEW_INTERVAL / 100);

        } else if (response === "hard") {
            card.ease_factor[index] = Math.max(130, card.ease_factor[index] - 15);
            card.interval[index] = card.interval[index] * (Main.sched.HARD_MULTIPLIER / 100) * Main.sched.INTERVAL_MODIFIER / 100;

        } else if (response === "good") {
            card.interval[index] = (card.interval[index] * card.ease_factor[index] / 100
                * Main.sched.INTERVAL_MODIFIER / 100);

        } else if (response === "easy") {
            card.ease_factor[index] += 15;
            card.interval[index] = (card.interval[index] * card.ease_factor[index] / 100
                * Main.sched.INTERVAL_MODIFIER / 100 * Main.sched.EASY_BONUS / 100);

        } else {
            return null;
        }
    } else if (card.status[index] === "relearning") {
        if (response === "fail") {
            card.steps_index[index] = 0;

        } else if (response === "hard") {
            card.steps_index[index] = 0;

        } else if (response === "good") {
            card.steps_index[index] += 1;

            if (card.steps_index[index] >= Main.sched.LAPSES_STEPS.length) {
                card.status[index] = "learned";
            }
        } else if (response === "easy") {
            card.status[index] = "learned";

        } else {
            return null;
        }
    }
}

// show result times of each option to user
function showTimes(times) {
    let options = document.querySelector(".card-options");
    let newTimes = document.createElement("div");
    newTimes.className = "hide card-options";
    newTimes.innerHTML =
        `<div class="font-sm">${readableTime(times[0])}</div>
        <div class="font-sm">${readableTime(times[1])}</div>
        <div class="font-sm">${readableTime(times[2])}</div>
        <div class="font-sm">${readableTime(times[3])}</div>
        <div class="card-option" data-index="0" data-option="fail">1 - Fail</div>
        <div class="card-option" data-index="1" data-option="hard">2 - Hard</div>
        <div class="card-option" data-index="2" data-option="good">3 - Good</div>
        <div class="card-option" data-index="3" data-option="easy">4 - Easy</div>`;

    options.replaceWith(newTimes);
}

// get times for each option of a card
function getTimes(card, side) {
    let index = side === "front" ? 0 : 1;
    let times = [];

    if (card.status[index] === "learning") {
        // fail, hard
        times = [toMS(Main.sched.NEW_STEPS[0], "minutes"),
            toMS(Main.sched.NEW_STEPS[0], "minutes")];
        
        // good
        if (card.steps_index[index] + 1 < Main.sched.NEW_STEPS.length) {
            times.push(toMS(Main.sched.NEW_STEPS[card.steps_index[index] + 1], "minutes"));
        } else {
            times.push(toMS(Main.sched.GRADUATING_INTERVAL, "days"));
        }

        // easy
        times.push(toMS(Main.sched.EASY_INTERVAL, "days"));
            
    } else if (card.status[index] === "learned") {
        let hardInterval = card.interval[index] = card.interval[index] * (Main.sched.HARD_MULTIPLIER / 100) * Main.sched.INTERVAL_MODIFIER / 100;
        let goodInterval = (card.interval[index] * card.ease_factor[index] / 100
            * Main.sched.INTERVAL_MODIFIER / 100);
        let easyInterval = (card.interval[index] * (card.ease_factor[index] + 15) / 100
            * Main.sched.INTERVAL_MODIFIER / 100 * Main.sched.EASY_BONUS / 100);

        times = [toMS(Main.sched.LAPSES_STEPS[0], "minutes"),
            toMS(Math.min(Main.sched.MAXIMUM_INTERVAL, hardInterval), "days"),
            toMS(Math.min(Main.sched.MAXIMUM_INTERVAL, goodInterval), "days"),
            toMS(Math.min(Main.sched.MAXIMUM_INTERVAL, easyInterval), "days")
        ];
        
    } else if (card.status[index] === "relearning") {
        // fail hard
        times = [toMS(Main.sched.LAPSES_STEPS[0], "minutes"),
            toMS(Main.sched.LAPSES_STEPS[0], "minutes")]

        // good
        if (card.steps_index[index] + 1 < Main.sched.LAPSES_STEPS.length) {
            times.push(toMS(Main.sched.LAPSES_STEPS[card.steps_index[index] + 1], "minutes"));
        } else {
            times.push(toMS(Math.min(Main.sched.MAXIMUM_INTERVAL, card.interval[index]), "days"));
        }

        // easy
        times.push(toMS(Math.min(Main.sched.MAXIMUM_INTERVAL, card.interval[index]), "days"));
    }

    // not actually due yet
    if (card.dueDate[index] > Date.now()) {
        for (let i = 0; i < times.length; i++) {
            times[i] /= 2;
        }
    }

    return times;
}

// convert to milliseconds
function toMS(time, units) {
    if (units === "days") {
        return time * 86400000;
    } else if (units === "minutes") {
        return time * 60000;
    } else {
        return undefined;
    }
}

function readableTime(time) {
    if (time < 1000)
        return `<1 sec`;
    else if (time < 60000)
        return `<1 min`;
    else if (time < 3600000)
        return `~${Math.trunc(time / 60000)} min`;
    else if (time < 86400000)
        return `~${Math.trunc(time / 3600000)} hr`;
    else if (time < 31556952000)
        return `~${Math.trunc(time / 86400000)} day(s)`;
    else
        return `~${Math.trunc(time / 31556952000)} year(s)`;
}