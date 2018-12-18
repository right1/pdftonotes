//Elements to exclude from splitter detection
const BLACKLIST = ['/', '\u200b', '\t', '\n', ',', "'", "-", String.fromCharCode(160), String.fromCharCode(8239),
    ':', '≠', '"', '(', ')', '”', ';', '.', ';', '=', 'Δ', 'ε', 'δ', 'α', 'x', 'β', 'π', 'ρ', 'φ', ' ', 'μ', '×','⋅'];
//Dictionary of extra words to trim
const EXTRAWORDS = {
    'This is the ': '',
    'this is the ': '',
    'as well': '',
    ' and ': ', ',
    'where the': ',',
    'Where the': '',
    'decided to': '→',
    'Decided to': '→',
    ' the ': ' ',
    'The ': ''
}
const VALID_BULLETPOINTS = ['-', '>', '⦒', '♞']
const DEBUG = false;//print debug messages to console
const quizletHeader = '^^^';//Quizlet delimiter after header
const quizletEndPage = ';;;';//Quizlet delimiter after page

let protectNested=true;//protects nested elements with the same bullet point
let fcViewIsVisible=false;
class flashCards{
    constructor(){
        this.cardsToDelete=[];
        this.elementsToChange=[];
    }
    setText(text){
        this.rawText=text;
        this.cards=text.split(quizletEndPage);
    }
    getText(){
        this.cardsToDelete.sort().reverse();
        this.rawText=join_ignoreEmpty(this.cards,quizletEndPage);
        this.cardsToDelete=[];
        return this.rawText;
    }
    getElementsToChange(){
        return this.elementsToChange;
    }
    setElementsToChange(e){
        this.elementsToChange=e;
    }
    getCards(){
        return this.cards;
    }
    getCard(index){
        return this.cards[index];
    }
    setCard(index,card){
        this.cards[index]=card;
    }
    deleteCard(index){
        this.cards[index]="";
    }
    numCards(){
        return this.cards.length;
    }
}
let quizletFlashcards=new flashCards();

$(function () {
    class pdfFile {
        constructor() {
            this.PDF = false;
        }
        setPDF(pdf_in) {
            this.PDF = pdf_in;
            return true;
        }
        convertPDF(ui) {
            startConversion(this.PDF, ui,function(txt){
                pdfFile.prototype.updateText(txt);
            });
        }
        updateText(txt){
            this.convertedText=txt;
        }
        getConvertedText() {
            console.log(this.convertedText);
            return this.convertedText;
        }
        getPDF_source() {
            return this.PDF;
        }
        loadDetails(ui) {
            detectSplitters(this.PDF, function (suggestedSplitters, badWords) {
                if (!suggestedSplitters || !ui) {
                    return;
                }
                console.log(suggestedSplitters);
                // displayBestSplitters(foundSplitters,4,true,'#suggestedSplitter');
                if (ui) {
                    displaySuggestedSplitters(suggestedSplitters);
                    hideBanner({//hiding detecting splitters banner
                        'color': 'yellow',
                        'time_hide': 250
                    })
                    let highestVal = badWords;
                    if (!highestVal) {
                        return suggestedSplitters;
                    }
                    if ($('#badWords').val() == "") {
                        $('#badWords').val(highestVal);
                    } else {
                        $('#badWords').val($('#badWords').val() + ',' + highestVal);
                    }
                    showBanner({
                        'color': 'red',
                        'text': 'Added "' + highestVal + '" to exclusion list.',
                        'time_show': 250,
                        'time_hide': 250,
                        'time_duration': 4000
                    })
                }
                return suggestedSplitters;
            });

        }
    }
    
    class splitterStorage {
        constructor(baseID, amount) {
            this.baseID = baseID;
            this.amount = amount;
            this.splitters = [""];
            this.heights=[];
        }
        update() {
            for (let i = 1; i <= this.amount; i++) {
                this.splitters[i] = trimWhitespace($(this.baseID + i).val().split(','));
                this.heights[i]=[];
            }
        }
        get(index) {
            return this.splitters[index];
        }
        setSplitterHeight(splitNo, index, height){
            this.heights[splitNo][index]=height;
        }
        getSplitterHeight(splitNo, index){
            return this.heights[splitNo][index];
        }
        splitterHeightExists(splitNo,index){
            if(this.heights[splitNo][index])return true;
            return false;
        }
        flushHeights(){
            for(let i=1;i<this.amount;i++){
                this.heights[i]=[];
            }
        }
    }
    //HTML INITIAL SETUP
    $('[data-toggle="tooltip"]').tooltip();
    $("[name='bsswitch']").bootstrapSwitch();
    $('.options').hide();
    // $('#test').click(function(){
    //     $('#4head').val(Math.random());
    //     $('#5head').val(Math.random());
    // })
    let badWords = [];
    let nastyWords = [];
    let pdfjsLib = window['pdfjs-dist/build/pdf'];
    // let suggestedSplitters = [];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.js';
    let quizletFormat = false;
    let bullet = '\t';
    // let userPDF;
    let trimExtra = true;
    let PDF = new pdfFile();
    let splitters = new splitterStorage('#splitter', 3);
    let multipleFlashcards = true;
    setTimeout(function () {
        showBanner({
            'color': 'blue',
            'time_show': 450,
            'time_hide': 450,
            'time_duration': 2500
        });
    }, 1500);
    $('#multipleFlashcards').bootstrapSwitch('state', true);
    // $('#quizletFormat').bootstrapSwitch('state', true);
    // $('#trimExtra').bootstrapSwitch('state', true);
    //HTML ONCHANGE EVENTS
    $('#quizletFormat').on('switchChange.bootstrapSwitch', function (event, state) {
        quizletFormat = state;
        $('#trimExtra').bootstrapSwitch('state', state);
        if (quizletFormat) {

            bullet = '-';
        } else {
            bullet = '\t';
        }
    });
    $('#trimExtra').on('switchChange.bootstrapSwitch', function (event, state) {
        trimExtra = state;
    });
    $('#multipleFlashcards').on('switchChange.bootstrapSwitch', function (event, state) {
        multipleFlashcards = state;
    });
    $('input[type="file"]').change(function (e) {
        let fileName = (e.target.files[0]) ? e.target.files[0].name : "Select file (or drag and drop)";
        let userPDF = e.target.files[0];
        if (userPDF.type != "application/pdf") {
            console.error(userPDF.name, " is not a pdf file.")
            alert(userPDF.name + " is not a pdf file.");
            return;
        }
        $('#filename').text(fileName);

        PDF.setPDF(userPDF);
        if (DEBUG) console.log('The file "' + fileName + '" has been selected.');
        showBanner({
            'color': 'yellow',
            'text': 'Detecting Bullet Points...',
            'time_show': 250
        })
        PDF.loadDetails(true);
    });
    $('#btnOptions').click(function () {
        if ($('.options').css('display') == 'none') {
            $('.options').show();
        } else {
            $('.options').hide();
        }
    })
    $('#btnCopy').click(function () {
        
        if(fcViewIsVisible){
            updateFC(-1);
            showAsFlashcards(quizletFlashcards);
        }
        const copyText = (quizletFormat)?quizletFlashcards.getText():PDF.getConvertedText();
        let textArea = document.createElement('textarea');
        textArea.classList.add('invis');
        textArea.textContent = copyText;
        $('#copyArea').append(textArea);
        // document.body.append(textArea);
        textArea.select();
        document.execCommand("copy");
        $('#btnCopy').text("Copied to clipboard");

        setTimeout(function () {
            $('#btnCopy').text("Copy to clipboard");
            $('.invis').remove();
        }, 2000);
    });
    $('#btnConvert').click(function () {
        PDF.convertPDF(true);
    });
    $('#convertQuizlet').click(function () {
        $('#trimExtra').bootstrapSwitch('state', true);
        $('#quizletFormat').bootstrapSwitch('state', true);
        PDF.convertPDF(true)
    });
    $('#editElements').click(function(){
        fcViewIsVisible=!fcViewIsVisible;
        if(fcViewIsVisible){
            $('.card-textarea').show();
            $('.card-static').hide();
        }else{
            $('.card-textarea').hide();
            $('.card-static').show();
        }
    });
    //FUNCTIONS
    function validateBullet() {
        let split1 = splitters.get(1);
        let split2 = splitters.get(2);
        let split3 = splitters.get(3);
        if (split1.indexOf(bullet) != -1 || split2.indexOf(bullet) != -1 || split3.indexOf(bullet) != -1) {
            if (VALID_BULLETPOINTS.indexOf(bullet) + 1 < VALID_BULLETPOINTS.length) {
                bullet = VALID_BULLETPOINTS[VALID_BULLETPOINTS.indexOf(bullet) + 1];
            } else {
                bullet = "";
            }

        }
    }
    function startConversion(userPDF, ui,callback) {
        if (!userPDF || !userPDF.type || userPDF.type != "application/pdf") {
            console.error((userPDF && userPDF.name) ? userPDF.name + " is not a pdf file." : "No PDF file selected");
            alert((userPDF && userPDF.name) ? userPDF.name + " is not a pdf file." : "No PDF file selected");
            return;
        }
        splitters.update();
        if (ui) {
            hideQuizletBtn();
            hideHelpBtn();
            $('#result').text('Result is being loaded...');
        }
        if (quizletFormat) validateBullet();
        let finalText_array = [""];
        let fileReader = new FileReader();
        let pageStart = parseInt($('#pageStart').val());
        let pageEnd = parseInt($('#pageEnd').val());
        let excludeStart = parseInt($('#excludeStart').val());
        let excludeEnd = parseInt($('#excludeEnd').val());
        let ignoreThreshold = parseInt($('#ignoreThreshold').val());
        if (ignoreThreshold == NaN) ignoreThreshold = 0;
        badWords = trimWhitespace($('#badWords').val().split(','));
        nastyWords = trimWhitespace($('#nastyWords').val().split(','));
        fileReader.onload = function () {
            let typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).then(function (pdf) {
                if (isNaN(pageEnd) || pageEnd == 0) pageEnd = pdf.numPages;
                if (isNaN(pageStart) || pageStart == 0) pageStart = 1;
                if (isNaN(excludeEnd)) excludeEnd = 0;
                if (isNaN(excludeStart)) excludeStart = 0;
                let count = pageStart;
                for (let i = pageStart; i <= pageEnd; i++) {
                    try {
                        getPageText(pdf, i, excludeStart, excludeEnd, ignoreThreshold, function (result, index) {
                            result = (trimExtra) ? trimExtraWords(result) : result;
                            finalText_array[index] = (quizletFormat) ? result + quizletEndPage : result;
                            let actuallyFull = true;
                            for (let j = pageStart; j <= pageEnd; j++) {
                                if (finalText_array[j] == null) {
                                    actuallyFull = false;
                                    break;
                                }
                            }
                            // if (finalText_array.length - 1 === pageEnd) {

                            // } else {
                            //     actuallyFull = false;
                            // }
                            if (actuallyFull) {
                                // console.log(finalText_array);
                                let endResult = finalText_array.join('').replace(/EMPTYPAGE/g, '')
                                if (ui) updateResult(endResult);
                                callback(endResult);
                            }


                        });
                    } catch (e) {
                        console.log("Failed on getPageText: " + e);
                        return e;
                    }
                }
            });
        };
        fileReader.readAsArrayBuffer(userPDF);
    }
    //showBanner: shows banner alert
    //PARAMETERS
    //color: red, blue, yellow (default: blue)
    //text: text in banner (don't pass in to not update text)
    //time_show: show animation duration (default: 0)
    //time_hide: hide animation duration (default: 0)
    //time_duration: time to show banner (ms) (default: don't hide)
    function showBanner(params) {
        let bannerColor = params['color'] || 'blue';
        let text = params['text'] || false;
        let t_show = params['time_show'] || 0;
        let t_hide = params['time_hide'] || 0;
        let duration = params['time_duration'] || false;
        if (text) {
            $('#bannerText_' + bannerColor).text(text);
        }
        $('#' + bannerColor + 'Banner').show(t_show);
        if (duration) {
            setTimeout(function () {
                $('#' + bannerColor + 'Banner').hide(t_hide);
            }, duration)
        }
    }
    //hideBanner: hides banner alert
    //PARAMETERS
    //color: red, blue, yellow (default: blue)
    //time_hide: hide animation duration (default: 0)
    function hideBanner(params) {
        let bannerColor = params['color'] || 'blue';
        let t_hide = params['time_hide'] || 0;
        $('#' + bannerColor + 'Banner').hide(t_hide);
    }
    function showQuizletBtn() {
        setTimeout(function () {
            $('.quizletHelp').show(100);
        }, 100);
    }
    function showHelpBtn() {
        setTimeout(function () {
            $('.help').show(100);
        }, 100);
    }
    function hideQuizletBtn() {
        setTimeout(function () {
            $('.quizletHelp').hide(100);
        }, 100);
    }
    function hideHelpBtn() {
        setTimeout(function () {
            $('.help').hide(100);
        }, 100);
    }
    function trimExtraWords(text) {
        let keepReplacing = true;
        while (keepReplacing) {
            keepReplacing = false;
            $.each(EXTRAWORDS, function (key, value) {
                if (text.indexOf(key) != -1) {
                    keepReplacing = true;
                    text = text.replace(key, value);
                    if (DEBUG && false) console.log([key, value]);
                }
            })
        }
        return text;
    }
    function trimWhitespace(textArray) {
        try {
            for (x in textArray) {
                textArray[x] = textArray[x].trim();
            }
        } catch (e) {
            console.log(e);
            alert("String trim failed, error: " + e);
            return textArray;
        }
        return textArray;
    }
    function arrangeDetectedSplitters(foundSplitters, firstChars) {
        for (x in firstChars) {
            if (firstChars[x].substring(0, 1) == ' ') {
                firstChars[x] = firstChars[x].substring(1, firstChars[x].length);
            }
            if (firstChars[x].substring(firstChars[x].length - 1, firstChars[x].length) == ' ') {
                firstChars[x] = firstChars[x].substring(0, firstChars[x].length - 1);
            }
            if (firstChars[x].match(/[0-9]/i)) {
                firstChars[x] = "NUM";
            }
            if (firstChars[x].match(/[a-z]/i)) {
                firstChars[x] = "";
            }
            if (firstChars[x].match(/[A-Z]/i)) {
                firstChars[x] = "";
            }
        }
        for (x in firstChars) {
            let splitterExists = false;
            $.each(foundSplitters, function (key, value) {
                if (firstChars[x] == key) {
                    value['count'] = value['count'] + 1;
                    splitterExists = true;
                }
            });
            if (!splitterExists) {
                foundSplitters[firstChars[x]] = { count: 1, foundAt: x };
            }
        }
        return foundSplitters;
    }
    function getBestSplitters(foundSplitters, amount) {
        while (Object.keys(foundSplitters).length >= amount) {
            let lowestVal;
            let lowestVal_value = Number.MAX_SAFE_INTEGER;
            $.each(foundSplitters, function (key, value) {
                if (foundSplitters[key]['count'] < lowestVal_value) {
                    lowestVal = key;
                    lowestVal_value = foundSplitters[key]['count'];
                }
            });
            delete foundSplitters[lowestVal];
        }
        return foundSplitters;
    }

    function setSuggestedSplitters(foundSplitters) {
        //sort them by foundAt
        let splitters_with_foundAt = [];
        let splitters_sorted = [];
        while (Object.keys(foundSplitters).length > 0) {
            if (splitters_with_foundAt.length >= 3) break;
            let highestVal;
            let highestVal_value = -1;
            let highestVal_foundAt = -1;
            $.each(foundSplitters, function (key, value) {
                if (foundSplitters[key]['count'] > highestVal_value) {
                    highestVal = key;
                    highestVal_value = foundSplitters[key]['count'];
                    highestVal_foundAt = foundSplitters[key]['foundAt'];
                }
            });
            if (highestVal_value > 2 && highestVal != "") {
                let blacklisted = false;
                for (let blk = 0; blk < BLACKLIST.length; blk++) {
                    if (highestVal.indexOf(BLACKLIST[blk]) != -1) {
                        blacklisted = true;
                        break;
                    }
                }
                if (!blacklisted) {
                    splitters_with_foundAt.push({ "value": highestVal, "foundAt": highestVal_foundAt });
                }
            }
            delete foundSplitters[highestVal];
        }
        while (splitters_with_foundAt.length > 0) {
            let lowestFoundAt = splitters_with_foundAt[0]['foundAt'];
            let bestIndex = 0;
            for (let i = 1; i < splitters_with_foundAt.length; i++) {
                if (splitters_with_foundAt[i]['foundAt'] < lowestFoundAt) {
                    lowestFoundAt = splitters_with_foundAt[i]['foundAt'];
                    bestIndex = i;
                }
            }
            splitters_sorted.push(splitters_with_foundAt[bestIndex]['value']);
            splitters_with_foundAt.splice(bestIndex, 1);
        }
        return splitters_sorted;
    }
    function displaySuggestedSplitters(splitters) {
        if ($('#splitter1').val().length > 1 || $('#splitter2').val().length > 1 || $('#splitter3').val().length > 1) {
            return;
        }
        for (let i = 0; i < splitters.length; i++) {
            $('#splitter' + (i + 1)).val(splitters[i]);
        }

        if (splitters.length < 2 && multipleFlashcards) {
            $('#multipleFlashcards').bootstrapSwitch('state', false);
        }
    }
    function detectSplitters(PDF, callback) {
        // let headerDelim = ($('#headerDelim').is(':checked')) ? true : false;
        let finalText_array = [];
        // let finalText = "";
        let fileReader = new FileReader();
        let pageStart = parseInt($('#pageStart').val());
        let pageEnd = parseInt($('#pageEnd').val());
        let excludeStart = parseInt($('#excludeStart').val());
        let excludeEnd = parseInt($('#excludeEnd').val());
        let ignoreThreshold = parseInt($('#ignoreThreshold').val());
        if (ignoreThreshold == NaN) ignoreThreshold = 0;
        badWords = trimWhitespace($('#badWords').val().split(','));
        nastyWords = trimWhitespace($('#nastyWords').val().split(','));
        splitters.update();
        fileReader.onload = function () {
            let typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).then(function (pdf) {
                let detectedHeaders = {};
                if (isNaN(pageEnd) || pageEnd == 0) pageEnd = pdf.numPages;
                if (isNaN(pageStart) || pageStart == 0) pageStart = 1;
                if (isNaN(excludeEnd)) excludeEnd = 0;
                if (isNaN(excludeStart)) excludeStart = 0;
                for (let i = pageStart; i <= pageEnd; i++) {
                    try {
                        getPageText(pdf, i, excludeStart, excludeEnd, ignoreThreshold, function (result, index, firstChars, detectedHeaders) {
                            finalText_array[index] = result;
                            if (finalText_array.length - 1 === pageEnd && finalText_array.every(element => element !== null)) {
                                let actuallyFull = true;
                                for (let j = pageStart; j < finalText_array.length; j++) {
                                    if (finalText_array[j] == null) {
                                        actuallyFull = false;
                                        break;
                                    }
                                }
                                if (actuallyFull) {
                                    if (finalText_array.every(element => element === "EMPTYPAGE")) {
                                        alert("Couldn't detect any text in that file.");
                                        return false;
                                    }
                                    if (DEBUG) console.log(detectedHeaders);
                                    let foundSplitters = {};
                                    foundSplitters = arrangeDetectedSplitters(foundSplitters, firstChars);
                                    foundSplitters = getBestSplitters(foundSplitters, 8);
                                    let suggestedSplitters = setSuggestedSplitters(foundSplitters);
                                    let badWords = detectBadWords({ "pageCount": pageEnd - pageStart + 1, "detectedHeaders": detectedHeaders });
                                    callback(suggestedSplitters, badWords);
                                }
                            }
                        }, detectedHeaders);
                    } catch (e) {
                        console.log("Failed on getPageText: " + e);
                        callback(false);
                    }
                }
            });
        };
        fileReader.readAsArrayBuffer(PDF);
    }
    function detectBadWords(params) {
        let pageCount = params['pageCount'] || 0;
        let detectedHeaders = params['detectedHeaders'];
        let highestVal;
        let highestVal_value = 1;
        $.each(detectedHeaders, function (key, value) {
            if (value > highestVal_value && key.length > 2) {
                highestVal = key;
                highestVal_value = value;
            }
        });
        if (highestVal_value > pageCount / 12 && highestVal_value > 2 && highestVal.length > 2 && trimWhitespace($('#badWords').val().split(',')).indexOf(highestVal) == -1) {
            return highestVal;
        }
        return false;
    }
    function splitter_detectNumbers(splitters) {
        for (x in splitters) {
            if (splitters[x].match(/[0-9]/i)) {
                splitters[x] = "NUM";
            }
        }
        return splitters;
    }
    function detectHeader(textContent, headerSemi) {
        let textContent_ini = textContent;
        if (headerSemi == -1) headerSemi = 0;
        try {
            let max_Height = textContent.items[0].height;
            let max_index = 0;
            for (let i = 0; i < textContent.items.length; i++) {
                if (textContent.items[i].height > max_Height) {
                    max_Height = textContent.items[i].height;
                    max_index = i;
                }
            }
            if (textContent.items[headerSemi].height == max_Height) {
                //header at beginning

                let num = headerSemi;
                while (textContent.items[num].height == textContent.items[headerSemi].height) {
                    num++;
                }
                headerSemi = num;
            } else if (textContent.items[textContent.items.length - 1].height == max_Height) {
                //header at end
                let lastElement = textContent.items.pop();
                textContent.items.unshift(lastElement);
                if (DEBUG) console.log("shifted " + i);
            }
            //If its bad word
            let skipOver = findBadWords(textContent.items[headerSemi].str, false);
            if (DEBUG && skipOver) console.log("found bad word");
            let detectNumber = textContent.items[headerSemi].str.replace(/ /g, "");
            let parsedInt = parseInt(detectNumber);
            for (let i = 0; i < 100; i++) {
                if ($('#pageNumberDetection').is(':checked') && detectNumber.indexOf('.') == -1 && parsedInt == i && detectNumber.length < 3) {
                    skipOver = true;
                    if (DEBUG) console.log("found page number");
                    break
                }
            }

            if (skipOver && headerSemi < textContent.items.length - 1) {
                headerSemi++;
                return detectHeader(textContent, headerSemi);
            }
        } catch (e) {
            if (DEBUG) console.log(e);
            return {
                "headerSemi": headerSemi,
                "textContent": textContent_ini,
                "error": e
            }
        }
        return {
            "headerSemi": headerSemi,
            "textContent": textContent,
            "error": false
        }
    }
    function ignoreLoop(textContent) {
        let nastyWord = false;
        let charCount = 0;
        let firstChars = [];
        for (let j = 0; j < textContent.items.length; j++) {
            if (textContent.items[j].str.substring(0, 1).match(/[a-z]/i) || textContent.items[j].str.substring(1, 2).match(/[a-z]/i)) {
            } else {
                firstChars.push(textContent.items[j].str.substring(0, 2));
            }
            for (let k = 0; k < nastyWords.length; k++) {
                if (nastyWords[k].length > 1 && textContent.items[j].str.indexOf(nastyWords[k]) != -1) {
                    nastyWord = true;
                    break;
                }
            }
            // charCount += textContent.items[j].str.indexOf(nastyWord) != -1;
            charCount += textContent.items[j].str.length;
        }
        return {
            "charCount": charCount,
            "nastyWord": nastyWord,
            "firstChars": firstChars
        }
    }
    function findBadWords(textItem, checkLength) {
        if(badWords[0]=="")return false;
        for (let k = 0; k < badWords.length; k++) {
            if (textItem.indexOf(badWords[k]) != -1 && (badWords[k].length >= textItem.length / 2 || !checkLength)) {
                return true;

            }
        }
        return false;
    }
    function getPageText(pdf, pageNumber, excludeStart, excludeEnd, ignore, callback, detectedHeaders) {
        let finalText = "";
        let addTab = false;
        let headerDelim = ($('#headerDelim').is(':checked')) ? true : false;
        pdf.getPage(pageNumber).then(function (page) {
            page.getTextContent().then(function (textContent) {
                let split1 = splitters.get(1);
                let split2 = splitters.get(2);
                let split3 = splitters.get(3);
                splitters.flushHeights();
                split1 = splitter_detectNumbers(split1);
                split2 = splitter_detectNumbers(split2);
                split3 = splitter_detectNumbers(split3);
                let headerSemi = -1;
                let detectHeader_result = detectHeader(textContent, headerSemi);
                headerSemi = detectHeader_result['headerSemi'];
                textContent = detectHeader_result['textContent'];
                let numSearch = [1];
                let ignored = false;
                let charCount = 0;
                let nastyWord = false;
                let ignoreLoop_result = ignoreLoop(textContent);
                nastyWord = ignoreLoop_result['nastyWord'];
                charCount = ignoreLoop_result['charCount'];
                let firstChars = ignoreLoop_result['firstChars'];
                if (charCount < ignore || nastyWord) {
                    ignored = true;
                }
                if (!$('#addNewLine').is(':checked')) finalText += '\n';
                if (detectedHeaders && typeof detectedHeaders == "object") {
                    detectedHeaders = updateDetectedHeaders(textContent.items, detectedHeaders);
                }
                let splitterCount = 0;
                if (split3.length > 0 && split3[0] != "") {
                    splitterCount = 3;
                } else if (split2.length > 0 && split2[0] != "") {
                    splitterCount = 2;
                } else if (split1.length > 0 && split1[0] != "") {
                    splitterCount = 1;
                }
                let pageText = "";
                for (let j = excludeStart; j < textContent.items.length - excludeEnd; j++) {
                    let detectNumber = textContent.items[j].str.replace(/ /g, "");
                    let parsedInt = parseInt(detectNumber);
                    if(protectNested){
                        let itemTxt=textContent.items[j].str;
                        let found1=foundSplitter(itemTxt,split1);
                        let found2=foundSplitter(itemTxt,split2);
                        if( found1>-1|| found2>-1){
                            
                            if(found1>-1){
                                if(splitters.splitterHeightExists(1,found1)){
                                    if(splitters.getSplitterHeight(1,found1)>textContent.items[j].height){
                                        textContent.items[j].str=splitterReplace(split1,itemTxt,bullet,3);
                                    }
                                }else{
                                    splitters.setSplitterHeight(1,found1,textContent.items[j].height);
                                }
                            }else if(found2>-1){
                                if(splitters.splitterHeightExists(2,found2)){
                                    if(splitters.getSplitterHeight(2,found2)>textContent.items[j].height){
                                        textContent.items[j].str=splitterReplace(split2,itemTxt,bullet,4);
                                    }
                                }else{
                                    splitters.setSplitterHeight(2,found2,textContent.items[j].height);
                                }
                            }
                        }
                    }
                    
                    if ($('#pageNumberDetection').is(':checked') && detectNumber.indexOf('.') == -1 && parsedInt == pageNumber && detectNumber.length < 3) {
                        if (j == headerSemi) headerSemi++;
                        continue;
                    } else {
                        let textItem = textContent.items[j].str;
                        let remove = findBadWords(textItem,false);
                        if (remove) {
                            if (j == headerSemi) headerSemi++;
                        } else {
                            if (textItem == ' ') {
                                addTab = false;
                            }
                            if ($('#addNewLine').is(':checked') && (textItem.length > 150 || textContent.items[j].height > 10)) {
                                finalText += '\n';
                                addTab = true;
                            } else if (headerDelim && addTab && textItem != ' ') {
                                finalText += '\t'
                                addTab = false;
                            }
                            if ((split3.indexOf('NUM') != -1 || split2.indexOf('NUM') != -1 || split1.indexOf('NUM') != -1) && textItem.length > 3) {
                                let findProtectNumbers_result = findProtectNumbers(textItem, numSearch);
                                textItem = findProtectNumbers_result['text'];
                                numSearch = findProtectNumbers_result['numSearch'];
                            }
                            if (j <= headerSemi) {
                                if (multipleFlashcards && quizletFormat) {
                                    pageText += textItem;
                                    // finalText += splitterProcess_mult(textItem, quizletEndPage, split1, split2);
                                    // finalText+=quizletHeader;
                                } else {
                                    finalText += splitterProcess(textItem, "", split1, split2, split3);
                                }
                            } else {
                                if (multipleFlashcards && quizletFormat) {
                                    pageText += textItem;
                                    // finalText+=quizletHeader;
                                } else {
                                    finalText += textItem;
                                }

                            }
                        }
                    }
                    if (j == headerSemi && quizletFormat && !multipleFlashcards) {
                        finalText += quizletHeader;
                    }
                }
                // console.log(pageText);
                if (pageText != "") {
                    finalText += splitterProcess_mult(pageText, "", split1, split2);
                }
                finalText = finalText.replace(/ACTUAL;;NUM/g, '');
                if (multipleFlashcards && quizletFormat) {
                    finalText = validate(finalText, split1);
                }
                (ignored) ? callback('EMPTYPAGE', pageNumber, firstChars, detectedHeaders) : callback(finalText, pageNumber, firstChars, detectedHeaders);
            })
        });
    }
    function validate(text, split1) {
        let slides = text.split(quizletEndPage);
        if (slides.length == 0) return text;
        let title = "";
        if (slides.length == 1) {
            //replace first bullet point and return
            let lowestIndex = -1;
            for (let i = 0; i < split1.length; i++) {
                if (text.indexOf(split1[i]) != -1) {
                    lowestIndex = text.indexOf(split1[i]);
                }
            }
            if (lowestIndex == -1) {
                return text;
            } else {
                return text.substr(0, lowestIndex) + quizletHeader + text.substr(lowestIndex + 1, text.length);
            }
        }
        if (slides[0].indexOf(quizletHeader) == -1) {
            title = slides[0];
            title += ": "
            slides.shift();
        }
        let madeTitleSlide = -1;
        for (x in slides) {

            while (occurrences(slides[x], quizletHeader) > 1) {
                if (slides[x].indexOf(quizletHeader) < 3) {
                    slides[x] = slides[x].replace(quizletHeader, "\n");
                } else {
                    slides[x] = replaceLastInstance(quizletHeader, slides[x], "\n");
                }
            }
            if (slides[x].indexOf(quizletHeader) == -1 && madeTitleSlide == -1) {
                slides[x] = title + quizletHeader + slides[x];
                madeTitleSlide = x;
                console.log("title slide made");
                // console.log(slides);
            } else if (slides[x].indexOf(quizletHeader) > 3) {
                slides[x] = title + slides[x];
            }
            if (slides[x].split(quizletHeader)[0].length > 50) {
                if (madeTitleSlide > -1) {
                    console.log("detected long title, but title slide exists");
                } else {
                    madeTitleSlide = x;
                    slides[x] = slides[x].replace(title, "");
                    slides[x] = slides[x].replace(quizletHeader, "");
                    slides[x] = title + quizletHeader + slides[x];
                }
            }
        }
        for (x in slides) {
            if (slides[x].indexOf(quizletHeader) < 3) {
                slides[madeTitleSlide] += '\n';
                slides[madeTitleSlide] += slides[x];
            }
        }
        for (x in slides) {
            if (slides[x].indexOf(quizletHeader) < 3) {
                slides.splice(x, 1);
            }
        }
        while (occurrences(slides[x], quizletHeader) > 1) {
            slides[x] = replaceLastInstance(quizletHeader, slides[x], '\n');
        }
        // console.log(slides);
        return slides.join(quizletEndPage);
        function replaceLastInstance(badtext, str, replacer) {
            if (!replacer) replacer = "";
            let charpos = str.lastIndexOf(badtext);
            if (charpos < 0) return str;
            ptone = str.substring(0, charpos);
            pttwo = str.substring(charpos + (badtext.length));
            return (ptone + replacer + pttwo);
        }
    }
    function updateDetectedHeaders(textItemArray, detectedHeaders) {
        if (textItemArray[0]) {//First Element
            if (detectedHeaders[textItemArray[0].str]) {
                detectedHeaders[textItemArray[0].str]++;
            } else {
                detectedHeaders[textItemArray[0].str] = 1;
            }
        }
        if (textItemArray[1]) {//Second Element
            if (detectedHeaders[textItemArray[1].str]) {
                detectedHeaders[textItemArray[1].str]++;
            } else {
                detectedHeaders[textItemArray[1].str] = 1;
            }
        }
        if (textItemArray[textItemArray.length - 1]) {//Last element
            if (detectedHeaders[textItemArray[textItemArray.length - 1].str]) {
                detectedHeaders[textItemArray[textItemArray.length - 1].str]++;
            } else {
                detectedHeaders[textItemArray[textItemArray.length - 1].str] = 1;
            }
        }
        if (textItemArray[textItemArray.length - 2]) {//Second to Last element
            if (detectedHeaders[textItemArray[textItemArray.length - 2].str]) {
                detectedHeaders[textItemArray[textItemArray.length - 2].str]++;
            } else {
                detectedHeaders[textItemArray[textItemArray.length - 2].str] = 1;
            }
        }
        return detectedHeaders;
    }
    function findProtectNumbers(textItem, numSearch) {
        for (let index = 0; index <= numSearch.length; index++) {
            if (textItem.indexOf(numSearch[index] + $('#numDelim').val()) != -1) {
                if (DEBUG) console.log(numSearch[index] + " found in", textItem);
                textItem = textItem.replace(numSearch[index] + $('#numDelim').val(), numSearch[index] + "ACTUAL;;NUM" + $('#numDelim').val());
                numSearch[index]++;
            }
        }
        let keepReplacing = true;
        while (keepReplacing) {
            keepReplacing = false;
            for (let protectNum = 100; protectNum > 0; protectNum--) {
                if (textItem.indexOf(protectNum + $('#numDelim').val()) != -1) {
                    keepReplacing = true;
                    if (DEBUG) console.log(protectNum + " protected in", textItem);
                }
                textItem = textItem.replace(protectNum + $('#numDelim').val(), protectNum + "PLA.'CEHOLDER" + $('#numDelim').val());
            }
        }
        return {
            "text": textItem,
            "numSearch": numSearch
        }
    }
    
    function updateResult(text) {
        let convertedText = convertText(text);
        
        if(quizletFormat){
            $('#result').hide();
            $('#flashCards').show();
            quizletFlashcards.setText(convertedText);
            showAsFlashcards(quizletFlashcards);
            showQuizletBtn();
        }else{
            $('#result').show();
            $('#flashCards').hide();
            $('#result').text(convertedText);
            showHelpBtn();
        }
    }
    
    function convertText(userText) {
        // let useSuggestedSplitters = false;
        let split1 = splitters.get(1);
        let split2 = splitters.get(2);
        let split3 = splitters.get(3);
        userText = splitterProcess(userText, bullet, split1, split2, split3);
        let userTextArray = userText.split('\n');
        let elementsToRemove = [];
        for (let i = 0; i < userTextArray.length; i++) {
            while (userTextArray[i].indexOf(' ') == 0) {//removing leading spaces
                userTextArray[i] = userTextArray[i].replace(' ', '');
            }
            if (userTextArray[i] == "") {
                elementsToRemove.push(i);
            }
        }
        // console.log(elementsToRemove);
        // console.log(userTextArray);
        for (let i = elementsToRemove.length - 1; i >= 0; i--) {
            userTextArray.splice(elementsToRemove[i], 1);
        }
        let userTextArray_joined = userTextArray.join('\n');
        userTextArray_joined = userTextArray_joined.replace(/PLA.'CEHOLDER/g, '');
        return userTextArray_joined;
    }
    function splitterReplace(splitters, text, replacer, replacerRepeat) {
        for (splitter in splitters) {
            while (splitters[splitter] != "NUM" && splitters[splitter] != "" && text.indexOf(splitters[splitter]) != -1) {
                text = text.replace(splitters[splitter], "\n" + replacer.repeat(replacerRepeat));
            }
        }
        return text;
    }
    function splitterReplace_Num(text, numDelim, replacer, replacerRepeat) {
        let keepReplacing = true;
        while (keepReplacing) {
            keepReplacing = false;
            for (let i = 100; i > 0; i--) {
                if (text.indexOf(i + numDelim) != -1) keepReplacing = true;
                text = text.replace(i + numDelim, "\n" + replacer.repeat(replacerRepeat));
            }
        }
        return text;
    }
    function splitterProcess_mult(userText, replacer, split1, split2) {
        split1 = splitter_detectNumbers(split1);
        split2 = splitter_detectNumbers(split2);

        let numDelim = $('#numDelim').val();
        let splitterCount = 0;
        if (split2.length > 0 && split2[0] != "") {
            splitterCount = 2;
        } else if (split1.length > 0 && split1[0] != "") {
            splitterCount = 1;
        }
        if (splitterCount < 2) {
            return splitterProcess(userText, replacer, split1, split2, []);
        }
        if (split1.indexOf("NUM") != -1) {
            userText = splitterReplace_Num(userText, numDelim, "⎠", 1);
            split1.push("⎠");
        } else if (split2.indexOf("NUM") != -1) {
            userText = splitterReplace_Num(userText, numDelim, "⎠", 1);
            split2.push("⎠");
        }
        while (true) {
            let index1 = foundSplitter(userText, split1);
            let index2 = foundSplitter(userText, split2);
            if (index1 == -1 || index2 == -1) break;
            if (index2 < index1) {
                userText = userText.substr(0, index2) + '\n' + bullet + userText.substr(index2 + 1);
                continue;
            }
            // console.log("before: " + userText);
            userText = userText.substr(0, index1) + quizletEndPage + userText.substr(index1 + 1);
            index2 = foundSplitter(userText, split2);
            userText = userText.substr(0, index2) + quizletHeader + userText.substr(index2 + 1);
            // console.log("after: " + userText);
        }
        userText = splitterReplace(["⎠"], userText, "", 1);//flushing remaining whatever this thing is

        return userText;
        
    }
    function foundSplitter(text, splitters) {
        let lowestIndex = -1;
        for (x in splitters) {
            if (text.indexOf(splitters[x]) != -1) {
                lowestIndex = text.indexOf(splitters[x]);
            }
        }
        return lowestIndex;
    }
    function splitterProcess(userText, replacer, split1, split2, split3) {
        split1 = splitter_detectNumbers(split1);
        split2 = splitter_detectNumbers(split2);
        split3 = splitter_detectNumbers(split3);

        let numDelim = $('#numDelim').val();
        let splitterCount = 0;
        if (split3.length > 0 && split3[0] != "") {
            splitterCount = 3;
        } else if (split2.length > 0 && split2[0] != "") {
            splitterCount = 2;
        } else if (split1.length > 0 && split1[0] != "") {
            splitterCount = 1;
        }
        if (splitterCount > 2) {
            userText = splitterReplace(split3, userText, replacer, 3);
        }
        if (splitterCount > 2 && split3.indexOf("NUM") != -1) {
            userText = splitterReplace_Num(userText, numDelim, replacer, 3);
        }

        if (splitterCount > 1) {
            userText = splitterReplace(split2, userText, replacer, 2);
        }
        if (splitterCount > 1 && split2.indexOf("NUM") != -1) {
            userText = splitterReplace_Num(userText, numDelim, replacer, 2);
        }

        if (splitterCount > 0) {
            userText = splitterReplace(split1, userText, replacer, 1);
        }
        if (splitterCount > 0 && split1.indexOf("NUM") != -1) {
            userText = splitterReplace_Num(userText, numDelim, replacer, 1);
        }
        return userText;
    }

    //drag and drop
    let lastTarget = null;

    function isFile(evt) {
        let dt = evt.dataTransfer;

        for (let i = 0; i < dt.types.length; i++) {
            if (dt.types[i] === "Files") {
                return true;
            }
        }
        return false;
    }

    window.addEventListener("dragenter", function (e) {
        if (isFile(e)) {
            lastTarget = e.target;
            document.getElementById('dropzone').style.visibility = "";
            document.getElementById('dropzone').style.opacity = 1;
        }
    });

    window.addEventListener("dragleave", function (e) {
        e.preventDefault();
        if (e.target === document || e.target === lastTarget) {
            document.getElementById('dropzone').style.visibility = "hidden";
            document.getElementById('dropzone').style.opacity = 0;
        }
    });

    window.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    window.addEventListener("drop", function (e) {
        e.preventDefault();
        document.getElementById('dropzone').style.visibility = "hidden";
        document.getElementById('dropzone').style.opacity = 0;
        if (e.dataTransfer.files.length == 1) {
            let fileName = (e.dataTransfer.files[0]) ? e.dataTransfer.files[0].name : "Select file (or drag and drop)";
            let userPDF = e.dataTransfer.files[0];
            if (userPDF.type != "application/pdf") {
                console.error(userPDF.name, "is not a pdf file.")
                alert(userPDF.name + " is not a pdf file.");
                return;
            }
            PDF.setPDF(userPDF);
            $('#filename').text(fileName);

            if (DEBUG) console.log('The file "' + fileName + '" has been selected.');
            showBanner({
                'color': 'yellow',
                'text': 'Detecting Bullet Points...',
                'time_show': 250
            })
            PDF.loadDetails(true);
        }
    });
});
function join_ignoreEmpty(arr,joiner){
    let text="";
    for(let i=0;i<arr.length;i++){
        if(arr[i]!=""&&i!=(arr.length-1)){
            text+=arr[i];
            text+=joiner;
        }else{
            text+=arr[i];
        }
    }
    return text;
}
function removeFC(index){
    quizletFlashcards.deleteCard(index);
    console.log('removed '+index);
    $('#flashcard'+index).hide('100');
}
function updateElementsToChange(value){
    let index=parseInt(value.id.replace('flashcard-A','').replace('flashcard-B',''));
    let elems=quizletFlashcards.getElementsToChange();
    if(elems.indexOf(index)==-1){
        elems.push(index);
    }
    quizletFlashcards.setElementsToChange(elems);
}
function updateFC(index){
    let elems=quizletFlashcards.getElementsToChange();
    if(index!=-1&& elems.indexOf(index)==-1){
        elems.push(index);
    }
    for(let i=0;i<elems.length;i++){
        let card=$('#flashcard-A'+elems[i]).val()+quizletHeader+$('#flashcard-B'+elems[i]).val();
        if(card!=quizletFlashcards.getCard(elems[i])){
            quizletFlashcards.setCard(elems[i],card);
        }
    }
    quizletFlashcards.setElementsToChange([]);
    showAsFlashcards(quizletFlashcards);
}
function showAsFlashcards(fc){
    let cards=fc.getCards();
    $('#flashCards').html('');
    for(let i=0;i<cards.length;i++){
        if(cards[i].length<4)continue;//will get handled by quizlet
        let card_split=cards[i].split(quizletHeader)
        let btnHTML="<div class='t-center mt-1'><button onclick=removeFC(this.value) class='btn btn-danger flashcard-btn mr-1' value='"+i+"'>Remove</button><button onclick=updateFC(this.value) class='btn btn-success flashcard-btn ml-1 card-textarea' value='"+i+"'>Update</button></div>"
        let cardHTML_left="<div class='card-header'><textarea class='form-control rounded-0 card-textarea' onchange=updateElementsToChange(this) id='flashcard-A"+i+"'>";
        // cardHTML_left+=btnHTML;
        if(card_split[0].indexOf('\n')<1)card_split[0]=card_split[0].replace('\n','');//getting rid of extra newlines from previous replacement
        cardHTML_left+=card_split[0];
        cardHTML_left+="</textarea><span class='card-static'>";
        cardHTML_left+=card_split[0];
        cardHTML_left+="</span></div>";
        card_split.shift();
        let cardHTML_right="<div class='card-body'><textarea class='form-control rounded-0 card-textarea' onchange=updateElementsToChange(this) id='flashcard-B"+i+"'>";
        cardHTML_right+=(card_split.length>0)?card_split.join(" "):"-";
        cardHTML_right+="</textarea><span class='card-static'>"
        cardHTML_right+=(card_split.length>0)?card_split.join(" "):"-";
        cardHTML_right+="</span>"
        cardHTML_right+=btnHTML;
        cardHTML_right+="</div>";
        let panelType=(i%2==0)?("card bg-light mb-3"):("card bg-dark text-white mb-3")
        $('#flashCards').html($('#flashCards').html()+"<div id='flashcard"+i+"' class='"+panelType+"'>"+cardHTML_left+cardHTML_right+"</div>")
    }
    $('.card-textarea').hide();
    fcViewIsVisible=false;
}
function occurrences(string, subString, allowOverlapping) {

    string += "";
    subString += "";
    if (subString.length <= 0) return (string.length + 1);

    let n = 0,
        pos = 0,
        step = allowOverlapping ? 1 : subString.length;

    while (true) {
        pos = string.indexOf(subString, pos);
        if (pos >= 0) {
            ++n;
            pos += step;
        } else break;
    }
    return n;
}

