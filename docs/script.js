let lat = "";
let lon = "";
let liveUpdates = null;
let sseSince = Math.floor(Date.now() / 1000);
let seenMessageIds = new Set();

const lambdaUrl = 'https://pqy3uiungkvualjhk7f3eo5qdy0wfcii.lambda-url.eu-north-1.on.aws/';

const params = new URLSearchParams(document.location.search);
if (params.has('subject')) {
    document.getElementById("subject").value = params.get('subject');
}

function saveInput(cname, cvalue) {
    if (typeof (Storage) !== "undefined") {
        localStorage.setItem(cname, cvalue);
    }
}

function loadInput(cname) {
    if (typeof (Storage) !== "undefined") {
        let res = localStorage.getItem(cname);
        return res || "";
    } else {
        return "";
    }
}

let cookieInput = loadInput("from");
if (cookieInput !== "") {
    document.getElementById('from').value = cookieInput;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(ch) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[ch];
    });
}

function getItemCreatedAt(item) {
    if (item['created_at']) {
        return Number(item['created_at']);
    }
    return Number(item['time_stamp']) - 36*3600;
}

function getMessageKey(item) {
    if (item['message_id']) {
        return item['message_id'];
    }
    return [
        getItemCreatedAt(item),
        item['from'] || "",
        item['subject'] || "",
        item['text'] || ""
    ].join("|");
}

function setLiveStatus(text) {
    document.getElementById("liveStatus").textContent = text;
}

function startLiveUpdates() {
    if (liveUpdates) {
        liveUpdates.close();
    }

    let subject = document.getElementById("subject").value;
    if (lat === "" || lon === "" || subject === "") {
        return;
    }

    let url = new URL(lambdaUrl);
    url.searchParams.set("op", "sse");
    url.searchParams.set("lat_lon", lat + "_" + lon);
    url.searchParams.set("subject", subject);
    url.searchParams.set("since", String(Math.max(0, sseSince - 1)));

    liveUpdates = new EventSource(url.toString());

    liveUpdates.onopen = function() {
        setLiveStatus("Live updates connected.");
    };

    liveUpdates.addEventListener("message", function(e) {
        let item = JSON.parse(e.data);
        let createdAt = Number(item.created_at || 0);
        let messageKey = getMessageKey(item);
        if (seenMessageIds.has(messageKey)) {
            return;
        }

        seenMessageIds.add(messageKey);
        sseSince = Math.max(sseSince, createdAt);
        setLiveStatus("New message from " + (item.from || "someone nearby") + ".");
        getMsgs();
        liveUpdates.close();
        setTimeout(startLiveUpdates, 1000);
    });

    liveUpdates.onerror = function() {
        setLiveStatus("Live updates reconnecting...");
    };
}

function getMsgs() {
    var xhrAws = new XMLHttpRequest();
    xhrAws.responseType = 'json';

    xhrAws.onreadystatechange = function(e) {
        if ( xhrAws.readyState === 4) {
            if (xhrAws.status !== 200) {
                alert('Error from server: ' + xhrAws.status);
                return;
            }
            let resp = "";
            let sorted = this.response || [];
            sorted.sort(function(a,b){ 
                var x = a.time_stamp < b.time_stamp? -1 : 1; 
                return x; 
            });
            let twoDaysAgo = Math.floor(Date.now() / 1000 - 36*3600);
            for (let i=0; i < sorted.length; i++) {
                let item = sorted[i];
                if (item['text'] !== "" && item['subject'] === document.getElementById("subject").value) {
                    // only show msgs within last 1.5 days, as in TTL at Dynamo, expired items are typically deleted within a few days of their expiration time.
                    if (item['time_stamp'] < twoDaysAgo) {
                        console.warn("skipping recent msg " + item['text']); 
                    }
                    else {
                        sseSince = Math.max(sseSince, getItemCreatedAt(item));
                        seenMessageIds.add(getMessageKey(item));
                        resp =  
                            "<br><br> From: " + escapeHtml(item['from']) +
                            // "<br> Subject: " + item['subject'] +
                            "<br> Message: " + escapeHtml(item['text']) +
                            "<br> Date: " + new Date((item['time_stamp'] - 36*3600)*1000).toLocaleString() +
                            resp;
                    }
                }
            }
            if (resp === "") {
                resp = "<br><br>No messages found in the last days.";
            }
            document.getElementById("conversation").innerHTML = resp;
        }
    }

    xhrAws.open('POST', lambdaUrl, true);
    xhrAws.setRequestHeader("Content-Type", "application/json");
    xhrAws.send(JSON.stringify({ "lat_lon": lat + "_" + lon, "subject": document.getElementById("subject").value , "op": "get" }));
}

function getLoc() {
    if (navigator.geolocation) {
        console.info("Getting location... " + new Date().toJSON());
        navigator.geolocation.getCurrentPosition(function(position) {
            lat = String(position.coords.latitude);
            lon = String(position.coords.longitude);
            let googleMapsLink = 'https://www.google.com/maps/place/';
            if (lat.startsWith('-')) {
                googleMapsLink += lat.substring(1) + 'S+';
            }
            else {
                googleMapsLink += lat + "N+";
            }
            if (lon.startsWith('-')) {
                googleMapsLink += lon.substring(1) + 'W';
            }
            else {
                googleMapsLink += lon + "E";
            }
            document.getElementById("myLoc").href = googleMapsLink;
            console.log(googleMapsLink);
            document.getElementById("myMsg").disabled = false;
            console.info("Getting messages... " + new Date().toJSON());
            getMsgs();
            startLiveUpdates();
            console.info("Getting messages... Done " + new Date().toJSON());
        });
    } else {
        alert("GeoLocation is not supported by this browser.");
    }
}

function putMsg(msg, from, subject) {

    saveInput("from", from);

    var xhrAws = new XMLHttpRequest();

    xhrAws.onreadystatechange = function(e) {
        if ( xhrAws.readyState === 4) {
            if (xhrAws.status !== 201) {
                alert('Error from server: ' + xhrAws.status + this.responseText);
            }
            else {
                getMsgs();
                document.getElementById("msg").value = "";
            }
        }
    }

    xhrAws.open('POST', lambdaUrl, true);
    xhrAws.setRequestHeader("Content-Type", "application/json");
    xhrAws.send(JSON.stringify({ "lat_lon": lat + "_" + lon , "op": "put", "text": msg, "from": from, "subject": subject }));
}

if (document.getElementById("subject").value == "") {
    alert("Please set the subject in the address url, e.g., ?subject=YourSubjectHere");
}

if (lat === "") {
    alert('wait couple of seconds for the location to be set');
}

getLoc();

document.getElementById("myMsg").addEventListener('click', function(e) {
    let msg = document.getElementById("msg").value;
    let from = document.getElementById("from").value;
    let subject = document.getElementById("subject").value;
    if (msg !== "" && from !== "" && subject !== "") {
        putMsg(msg, from, subject);
    }
    else {
        alert("Please fill in all fields, subject in the address url, and from/Message.");
    }
}); 

document.getElementById("refresh").addEventListener('click', function(e) {
    getMsgs();
});
