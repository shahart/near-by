let lat = "";
let lon = "";

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
            let sorted = this.response;
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
                        resp =  
                            "<br><br> From: " + item['from'] +
                            // "<br> Subject: " + item['subject'] +
                            "<br> Message: " + item['text'] +
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

    xhrAws.open('POST', 'https://pqy3uiungkvualjhk7f3eo5qdy0wfcii.lambda-url.eu-north-1.on.aws/', true);
    xhrAws.setRequestHeader("Content-Type", "application/json");
    xhrAws.send(JSON.stringify({ "lat_lon": lat + "_" + lon, "subject": document.getElementById("subject").value , "op": "get" }));
}

function getLoc() {
    if (navigator.geolocation) {
        // console.debug("Getting location... " + new Date().toJSON());
        navigator.geolocation.getCurrentPosition(function(position) {
            lat = position.coords.latitude;
            lon = position.coords.longitude;
            let googleMapsLink = 'https://www.google.com/maps/place/' + lat + 'N+' + lon + 'E';
            // document.getElementById("myLoc").href = googleMapsLink;
            console.log(googleMapsLink);
            document.getElementById("myMsg").disabled = false;
            // console.debug("Getting messages... " + new Date().toJSON());
            getMsgs();
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

    xhrAws.open('POST', 'https://pqy3uiungkvualjhk7f3eo5qdy0wfcii.lambda-url.eu-north-1.on.aws/', true);
    xhrAws.setRequestHeader("Content-Type", "application/json");
    xhrAws.send(JSON.stringify({ "lat_lon": lat + "_" + lon , "op": "put", "text": msg, "from": from, "subject": subject }));
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
});

// document.getElementById("refresh").addEventListener('click', function(e) {
//     getMsgs();
// });
