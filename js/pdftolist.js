//Elements to exclude from splitter detection
const BLACKLIST=['/','\u200b','\t','\n',',' ,"'" ,"-" ,String.fromCharCode(160) ,String.fromCharCode(8239),
':','≠','"','(',')','”',';','.',';','=','Δ','ε','δ','α','x','β','π','ρ','φ',' ','μ','×'];
//Dictionary of extra words to trim
const EXTRAWORDS={
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
const DEBUG=false;//print debug messages to console
const quizletHeader='^^^';//Quizlet delimiter after header
const quizletEndPage=';;;';//Quizlet delimiter after page
$(function () {
    //HTML INITIAL SETUP
    $('[data-toggle="tooltip"]').tooltip();
    $("[name='bsswitch']").bootstrapSwitch();
    $('.options').hide();

    var badWords = [];
    var nastyWords = [];
    var pdfjsLib = window['pdfjs-dist/build/pdf'];
    var suggestedSplitters=[];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.js';
    var quizletFormat=false;
    var bullet='\t';
    var userPDF;
    var trimExtra=true;
    setTimeout(function(){
        showBanner({
            'color':'blue',
            'time_show': 450,
            'time_hide': 450,
            'time_duration': 2500
        });
    },1500); 
    //HTML ONCHANGE EVENTS
    $('#quizletFormat').on('switchChange.bootstrapSwitch', function (event, state) {
        quizletFormat=state;
        $('#trimExtra').bootstrapSwitch('state',state);
        if(quizletFormat){
            
            bullet='-';
        }else{
            bullet='\t';
        }
    }); 
    $('#trimExtra').on('switchChange.bootstrapSwitch', function (event, state) {
        trimExtra=state;
    }); 
    $('input[type="file"]').change(function (e) {
        var fileName = (e.target.files[0]) ? e.target.files[0].name : "Click to select file (or drag and drop)";
        userPDF = e.target.files[0];
        if (userPDF.type != "application/pdf") {
            console.error(userPDF.name, " is not a pdf file.")
            alert(userPDF.name+ " is not a pdf file.");
            return;
        }
        $('#filename').text(fileName);


        if(DEBUG)console.log('The file "' + fileName + '" has been selected.');
        showBanner({
            'color': 'yellow',
            'text': 'Detecting Bullet Points...',
            'time_show': 250
        })
        detectSplitters();
    });
    $('#btnOptions').click(function () {
        if ($('.options').css('display') == 'none') {
            $('.options').show();
        } else {
            $('.options').hide();
        }
    })
    $('.suggestedSplitter').click(function(e){
        this.innerText="";
    });
    $('#suggestedSplitterBtn').click(function(){
        var tmp=$('#suggestedSplitterBtn_text').text();
        $('#suggestedSplitterBtn_text').text('Copied the text: '+suggestedSplitters.join('')+'\t');
        setTimeout(function(){
            $('#suggestedSplitterBtn_text').text(tmp);
        },2500);
        for(var i=1;i<=suggestedSplitters.length;i++){
            $('#suggestedSplitter'+i).text(suggestedSplitters[i-1]);
        }
        const textArea = document.createElement('textarea');
        textArea.textContent = suggestedSplitters.join('');
        document.body.append(textArea);
        textArea.select();
        document.execCommand("copy");
    })
    $('#btnCopy').click(function () {
        const copyText = document.getElementById("result").textContent;
        const textArea = document.createElement('textarea');
        textArea.textContent = copyText;
        document.body.append(textArea);
        textArea.select();
        document.execCommand("copy");
        $('#btnCopy').text("Copied to clipboard");

        setTimeout(function () {
            $('#btnCopy').text("Copy to clipboard");
        }, 2000);
    });
    $('#btnConvert').click(function () {
        startConversion();
    });
    $('#convertQuizlet').click(function(){
        $('#trimExtra').bootstrapSwitch('state',true);
        $('#quizletFormat').bootstrapSwitch('state',true);
        startConversion();
    });
    //FUNCTIONS
    function startConversion(){
        if (!userPDF || !userPDF.type || userPDF.type != "application/pdf") {
            console.error((userPDF&&userPDF.name)?userPDF.name + " is not a pdf file.": "No PDF file selected");
            alert((userPDF&&userPDF.name)?userPDF.name + " is not a pdf file.": "No PDF file selected");
            return;
        }
        hideQuizletBtn();
        hideHelpBtn();
        $('#result').text('Result is being loaded...');
        var finalText_array = [];
        var fileReader = new FileReader();
        var pageStart = parseInt($('#pageStart').val());
        var pageEnd = parseInt($('#pageEnd').val());
        var excludeStart = parseInt($('#excludeStart').val());
        var excludeEnd = parseInt($('#excludeEnd').val());
        var ignoreThreshold = parseInt($('#ignoreThreshold').val());
        if (ignoreThreshold == NaN) ignoreThreshold = 0;
        badWords = trimWhitespace($('#badWords').val().split(','));
        nastyWords = trimWhitespace($('#nastyWords').val().split(','));
        fileReader.onload = function () {
            var typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).then(function (pdf) {
                if (isNaN(pageEnd) || pageEnd == 0) pageEnd = pdf.numPages;
                if (isNaN(pageStart) || pageStart == 0) pageStart = 1;
                if (isNaN(excludeEnd)) excludeEnd = 0;
                if (isNaN(excludeStart)) excludeStart = 0;
                var count = pageStart;
                for (var i = pageStart; i <= pageEnd; i++) {
                    try{
                        getPageText(pdf, i, excludeStart, excludeEnd, ignoreThreshold, function (result, index) {
                            result=(trimExtra)?trimExtraWords(result):result;
                            finalText_array[index] = (quizletFormat)?result+quizletEndPage:result;
                            var actuallyFull=true;
                            
                            if (finalText_array.length - 1 === pageEnd) {
                                for(var j=pageStart;j<finalText_array.length;j++){
                                    if(finalText_array[j]==null){
                                        actuallyFull=false;
                                        break;
                                    }
                                }
                            }else{
                                actuallyFull=false;
                            }
                            if(actuallyFull){
                                updateResult(finalText_array.join('').replace(/EMPTYPAGE/g, ''));
                            }
                                
                            
                        });
                    }catch(e){
                        console.log("Failed on getPageText: "+e)
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
    function showBanner(params){
        var bannerColor=params['color']||'blue';
        var text=params['text']||false;
        var t_show=params['time_show']||0;
        var t_hide=params['time_hide']||0;
        var duration=params['time_duration']||false;
        if(text){
            $('#bannerText_'+bannerColor).text(text);
        }
        $('#'+bannerColor+'Banner').show(t_show);
        if(duration){
            setTimeout(function(){
                $('#'+bannerColor+'Banner').hide(t_hide);
            },duration)
        }
    }
    //hideBanner: hides banner alert
    //PARAMETERS
    //color: red, blue, yellow (default: blue)
    //time_hide: hide animation duration (default: 0)
    function hideBanner(params){
        var bannerColor=params['color']||'blue';
        var t_hide=params['time_hide']||0;
        $('#'+bannerColor+'Banner').hide(t_hide);
    }
    function showQuizletBtn(){
        setTimeout(function () {
            $('#quizletInfoBtn').show(100);
        }, 100);
    }
    function showHelpBtn(){
        setTimeout(function () {
            $('.help').show(100);
        }, 100);
    }
    function hideQuizletBtn(){
        setTimeout(function () {
            $('#quizletInfoBtn').hide(100);
        }, 100);
    }
    function hideHelpBtn(){
        setTimeout(function () {
            $('.help').hide(100);
        }, 100);
    }
    function trimExtraWords(text){
        var keepReplacing=true;
        while(keepReplacing){
            keepReplacing=false;
            $.each(EXTRAWORDS,function(key,value){
                if(text.indexOf(key)!=-1){
                    keepReplacing=true;
                    text=text.replace(key,value);
                    if(DEBUG&&false)console.log([key,value]);
                }
            })
        }
        return text;
    }
    function trimWhitespace(textArray){
        try{
            for(x in textArray){
                textArray[x]=textArray[x].trim();
            }
        }catch(e){
            console.log(e);
            alert("String trim failed, error: "+e);
            return textArray;
        }
        return textArray;
    }
    function arrangeDetectedSplitters(foundSplitters,firstChars){
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
            var splitterExists = false;
            $.each(foundSplitters, function (key, value) {
                if (firstChars[x] == key) {
                    foundSplitters[key] = value + 1;
                    splitterExists = true;
                }
            });
            if (!splitterExists) {
                foundSplitters[firstChars[x]] = 1;
            }
        }
        return foundSplitters;
    }
    function getBestSplitters(foundSplitters,amount){
        while (Object.keys(foundSplitters).length >= amount) {
            var lowestVal;
            var lowestVal_value = Number.MAX_SAFE_INTEGER;
            $.each(foundSplitters, function (key, value) {
                if (foundSplitters[key] < lowestVal_value) {
                    lowestVal = key;
                    lowestVal_value = foundSplitters[key];
                }
            });
            delete foundSplitters[lowestVal];
        }
        return foundSplitters;
    }
    function displayBestSplitters(foundSplitters,amountToDisplay,reset,resetID){
        var splitterDisplayCount = 1;
        //Resetting old splitters
        if(reset){
            for (var splitterResetCount = 1; splitterResetCount <= amountToDisplay; splitterResetCount++) {
                $(resetID + splitterResetCount).text('');
            }
        }
        while (Object.keys(foundSplitters).length > 0) {
            var highestVal;
            var highestVal_value = -1;
            $.each(foundSplitters, function (key, value) {
                if (foundSplitters[key] > highestVal_value) {
                    highestVal = key;
                    highestVal_value = foundSplitters[key];
                }
            });
            if (highestVal_value > 2 && splitterDisplayCount <= amountToDisplay &&highestVal!="") {
                var blacklisted=false;
                for(var blk=0;blk<BLACKLIST.length;blk++){
                    if(highestVal.indexOf(BLACKLIST[blk])!=-1){
                        blacklisted=true;
                        break;
                    }
                }
                if(!blacklisted){
                    $('#suggestedSplitter' + splitterDisplayCount).text(highestVal);
                    splitterDisplayCount++;
                    suggestedSplitters.push(highestVal);
                }
            }
            delete foundSplitters[highestVal];
        }
    }
    function detectSplitters() {
        // var headerDelim = ($('#headerDelim').is(':checked')) ? true : false;
        var finalText_array = [];
        // var finalText = "";
        var fileReader = new FileReader();
        var pageStart = parseInt($('#pageStart').val());
        var pageEnd = parseInt($('#pageEnd').val());
        var excludeStart = parseInt($('#excludeStart').val());
        var excludeEnd = parseInt($('#excludeEnd').val());
        var ignoreThreshold = parseInt($('#ignoreThreshold').val());
        if (ignoreThreshold == NaN) ignoreThreshold = 0;
        badWords = trimWhitespace($('#badWords').val().split(','));
        nastyWords = trimWhitespace($('#nastyWords').val().split(','));
        fileReader.onload = function () {
            var typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).then(function (pdf) {
                var detectedHeaders={};
                if (isNaN(pageEnd) || pageEnd == 0) pageEnd = pdf.numPages;
                if (isNaN(pageStart) || pageStart == 0) pageStart = 1;
                if (isNaN(excludeEnd)) excludeEnd = 0;
                if (isNaN(excludeStart)) excludeStart = 0;
                for (var i = pageStart; i <= pageEnd; i++) {
                    try{
                        getPageText(pdf, i, excludeStart, excludeEnd, ignoreThreshold, function (result, index,firstChars,detectedHeaders) {
                            finalText_array[index] = result;
                            if (finalText_array.length - 1 === pageEnd && finalText_array.every(element => element !== null)) {
                                var actuallyFull=true;
                                for(var j=pageStart;j<finalText_array.length;j++){
                                    if(finalText_array[j]==null){
                                        actuallyFull=false;
                                        break;
                                    }
                                }
                                if(actuallyFull){
                                    if (finalText_array.every(element => element === "EMPTYPAGE")) {
                                        alert("Couldn't detect any text in that file.");
                                    }
                                    if(DEBUG)console.log(detectedHeaders);
                                    var foundSplitters = {};
                                    foundSplitters=arrangeDetectedSplitters(foundSplitters,firstChars);
                                    foundSplitters=getBestSplitters(foundSplitters,8);
                                    suggestedSplitters=[];
                                    displayBestSplitters(foundSplitters,4,true,'#suggestedSplitter');
                                    hideBanner({//hiding detecting splitters banner
                                        'color': 'yellow',
                                        'time_hide': 250
                                    })
                                    detectBadWords({"pageCount":pageEnd-pageStart+1,"detectedHeaders":detectedHeaders});
                                }
                            }
                        },detectedHeaders);
                    }catch(e){
                        console.log("Failed on getPageText: "+e)
                    }
                }
            });
        };
        fileReader.readAsArrayBuffer(userPDF);
    }
    function detectBadWords(params){
        var pageCount=params['pageCount']||0;
        var detectedHeaders=params['detectedHeaders'];
        console.log(detectedHeaders);
        var highestVal;
        var highestVal_value=1;
        $.each(detectedHeaders,function(key,value){
            if(value>highestVal_value&&key.length>2){
                highestVal=key;
                highestVal_value=value;
            }
        });
        if(highestVal_value>pageCount/12&&highestVal_value>2&&highestVal.length>2&&trimWhitespace($('#badWords').val().split(',')).indexOf(highestVal)==-1){
            if($('#badWords').val()==""){
                $('#badWords').val(highestVal);
            }else{
                $('#badWords').val($('#badWords').val()+','+highestVal);
            }
            showBanner({
                'color': 'red',
                'text': 'Added "'+highestVal+'" to exclusion list.',
                'time_show': 250,
                'time_hide': 250,
                'time_duration': 4000
            })
        }
    }
    function splitter_detectNumbers(splitters){
        for (x in splitters) {
            if (splitters[x].match(/[0-9]/i)) {
                splitters[x] = "NUM";
            }
        }
        return splitters;
    }
    function detectHeader(textContent,headerSemi){
        var textContent_ini=textContent;
        if(headerSemi==-1)headerSemi=0;
        try{
            var max_Height=textContent.items[0].height;
            var max_index=0;
            for(var i=0;i<textContent.items.length;i++){
                if(textContent.items[i].height>max_Height){
                    max_Height=textContent.items[i].height;
                    max_index=i;
                }
            }
            if(textContent.items[headerSemi].height==max_Height){
                //header at beginning
                
                var num=headerSemi;
                while(textContent.items[num].height==textContent.items[headerSemi].height){
                    num++;
                }
                headerSemi=num;
            }else if(textContent.items[textContent.items.length-1].height==max_Height){
                //header at end
                var lastElement=textContent.items.pop();
                textContent.items.unshift(lastElement);
                if(DEBUG)console.log("shifted "+i);
            }
            //If its bad word
            var skipOver=findBadWords(textContent.items[headerSemi].str,false);
            if(DEBUG&&skipOver)console.log("found bad word");
            var detectNumber = textContent.items[headerSemi].str.replace(/ /g, "");
            var parsedInt = parseInt(detectNumber);
            for(var i=0;i<100;i++){
                if ($('#pageNumberDetection').is(':checked') && detectNumber.indexOf('.') == -1 && parsedInt==i&&detectNumber.length < 3) {
                    skipOver=true;
                    if(DEBUG)console.log("found page number");
                    break
                }
            }
            
            if(skipOver&&headerSemi<textContent.items.length-1){
                headerSemi++;
                return detectHeader(textContent,headerSemi);
            }
        }catch(e){
            if(DEBUG)console.log(e);
            return{
                "headerSemi":headerSemi,
                "textContent":textContent_ini,
                "error": e
            }
        }
        return{
            "headerSemi":headerSemi,
            "textContent":textContent,
            "error": false
        }
    }
    function ignoreLoop(textContent){
        var nastyWord=false;
        var charCount=0;
        var firstChars=[];
        for (var j = 0; j < textContent.items.length; j++) {
            if (textContent.items[j].str.substring(0, 1).match(/[a-z]/i) || textContent.items[j].str.substring(1, 2).match(/[a-z]/i)) {
            } else {
                firstChars.push(textContent.items[j].str.substring(0, 2));
            }
            for (var k = 0; k < nastyWords.length; k++) {
                if (nastyWords[k].length > 1 && textContent.items[j].str.indexOf(nastyWords[k]) != -1) {
                    nastyWord = true;
                    break;
                }
            }
            // charCount += textContent.items[j].str.indexOf(nastyWord) != -1;
            charCount += textContent.items[j].str.length;
        }
        return {
            "charCount" : charCount,
            "nastyWord": nastyWord,
            "firstChars": firstChars
        }
    }
    function findBadWords(textItem,checkLength){
        var chk=(checkLength)?checkLength:true;
        for (var k = 0; k < badWords.length; k++) {
            if (textItem.indexOf(badWords[k]) != -1 && (badWords[k].length >= textItem.length / 2 || !chk)) {
                return badWords[0]!=="";
            }
        }
        return false;
    }
    function getPageText(pdf, pageNumber, excludeStart, excludeEnd, ignore, callback,detectedHeaders) {
        var finalText = "";
        var addTab = false;
        var headerDelim = ($('#headerDelim').is(':checked')) ? true : false;
        pdf.getPage(pageNumber).then(function (page) {
            page.getTextContent().then(function (textContent) {
                var split1 = trimWhitespace($('#splitter1').val().split(','));
                var split2 = trimWhitespace($('#splitter2').val().split(','));
                var split3 = trimWhitespace($('#splitter3').val().split(','));
                split1=splitter_detectNumbers(split1);
                split2=splitter_detectNumbers(split2);
                split3=splitter_detectNumbers(split3);
                var headerSemi=-1;
                var detectHeader_result=detectHeader(textContent,headerSemi);
                headerSemi=detectHeader_result['headerSemi'];
                textContent=detectHeader_result['textContent'];
                var numSearch=[1];
                var ignored = false;
                var charCount = 0;
                var nastyWord = false;
                var ignoreLoop_result=ignoreLoop(textContent);
                nastyWord=ignoreLoop_result['nastyWord'];
                charCount=ignoreLoop_result['charCount'];
                var firstChars=ignoreLoop_result['firstChars'];
                if (charCount < ignore || nastyWord) {
                    ignored = true;
                }
                if (!$('#addNewLine').is(':checked')) finalText += '\n';
                if(detectedHeaders&&typeof detectedHeaders=="object"){
                    detectedHeaders=updateDetectedHeaders(textContent.items,detectedHeaders);
                }
                
                for (var j = excludeStart; j < textContent.items.length - excludeEnd; j++) {
                    var detectNumber = textContent.items[j].str.replace(/ /g, "");
                    var parsedInt = parseInt(detectNumber);
                    if ($('#pageNumberDetection').is(':checked') && detectNumber.indexOf('.') == -1 && parsedInt==pageNumber&&detectNumber.length < 3) {
                        if(j==headerSemi)headerSemi++;
                        continue;
                    } else {
                        var textItem = textContent.items[j].str;
                        var remove = findBadWords(textItem);
                        if (remove) {
                            if(j==headerSemi)headerSemi++;
                        }else {
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
                            if ((split3.indexOf('NUM') !=-1  || split2.indexOf('NUM') !=-1 || split1.indexOf('NUM') !=-1) && textItem.length > 3) {
                                var findProtectNumbers_result=findProtectNumbers(textItem,numSearch);
                                textItem=findProtectNumbers_result['text'];
                                numSearch=findProtectNumbers_result['numSearch'];
                            }
                            if(j<=headerSemi){
                                var useSuggestedSplitters = false;
                                if ((split1.length == 0 || (split1.length == 1 && split1[0] == '')) && (split2.length == 0 || (split2.length == 1 && split2[0] == '')) && (split3.length == 0 || (split3.length == 1 && split3[0] == ''))) {
                                    useSuggestedSplitters = true;
                                    split1 = [];
                                    split2 = [];
                                    split3 = [];
                                    for (var index = 1; index <= 4;index++) {
                                        if ($('#suggestedSplitter' + index).text().length > 0) {
                                            if (index <= 2) split1.push($('#suggestedSplitter' +index).text());
                                            else if (index == 3) split2.push($('#suggestedSplitter' +index).text());
                                            else split3.push($('#suggestedSplitter' +index).text());
                                        }
                                    }
                                }
                                finalText+=splitterProcess(textItem,"",split1,split2,split3);
                            }else{
                                finalText += textItem;
                            }
                        }
                    }
                    if(j==headerSemi&&quizletFormat){
                        finalText+=quizletHeader;
                    }
                }
                finalText = finalText.replace(/ACTUAL;;NUM/g, '');
                (ignored) ? callback('EMPTYPAGE', pageNumber,firstChars,detectedHeaders) : callback(finalText, pageNumber,firstChars,detectedHeaders);
            })
        });
    }
    function updateDetectedHeaders(textItemArray,detectedHeaders){
        if(textItemArray[0]){//First Element
            if(detectedHeaders[textItemArray[0].str]){
                detectedHeaders[textItemArray[0].str]++;
            }else{
                detectedHeaders[textItemArray[0].str]=1;
            }
        }
        if(textItemArray[1]){//Second Element
            if(detectedHeaders[textItemArray[1].str]){
                detectedHeaders[textItemArray[1].str]++;
            }else{
                detectedHeaders[textItemArray[1].str]=1;
            }
        }
        if(textItemArray[textItemArray.length-1]){//Last element
            if(detectedHeaders[textItemArray[textItemArray.length-1].str]){
                detectedHeaders[textItemArray[textItemArray.length-1].str]++;
            }else{
                detectedHeaders[textItemArray[textItemArray.length-1].str]=1;
            }
        }
        if(textItemArray[textItemArray.length-2]){//Second to Last element
            if(detectedHeaders[textItemArray[textItemArray.length-2].str]){
                detectedHeaders[textItemArray[textItemArray.length-2].str]++;
            }else{
                detectedHeaders[textItemArray[textItemArray.length-2].str]=1;
            }
        }
        return detectedHeaders;
    }
    function findProtectNumbers(textItem,numSearch){
        for (var index = 0; index <=numSearch.length; index++) {
            if (textItem.indexOf(numSearch[index] + $('#numDelim').val()) != -1 ) {
                if(DEBUG)console.log(numSearch[index]+" found in",textItem);
                textItem = textItem.replace(numSearch[index] + $('#numDelim').val(), numSearch[index] + "ACTUAL;;NUM" + $('#numDelim').val());
                numSearch[index]++;
            }
        }
        var keepReplacing=true;
        while(keepReplacing){
            keepReplacing=false;
            for (var protectNum = 100; protectNum > 0; protectNum--) {
                if (textItem.indexOf(protectNum + $('#numDelim').val()) != -1){
                    keepReplacing = true;
                    if(DEBUG)console.log(protectNum + " protected in",textItem);
                } 
                textItem = textItem.replace(protectNum + $('#numDelim').val(), protectNum+"PLA.'CEHOLDER" + $('#numDelim').val());
            }
        }
        return {
            "text":textItem,
            "numSearch":numSearch
        }
    }
    function updateResult(text) {
        var convertedText = convertText(text);
        $('#result').text(convertedText);
        (quizletFormat)?showQuizletBtn():showHelpBtn();
    }
    
    function convertText(userText) {
        // var useSuggestedSplitters = false;
        var split1 = trimWhitespace($('#splitter1').val().split(','));
        var split2 = trimWhitespace($('#splitter2').val().split(','));
        var split3 = trimWhitespace($('#splitter3').val().split(','));
        if ((split1.length == 0 || (split1.length == 1 && split1[0] == '')) && (split2.length == 0 || (split2.length == 1 && split2[0] == '')) && (split3.length == 0 || (split3.length == 1 && split3[0] == ''))) {
            // useSuggestedSplitters = true;
            showBanner({
                'color': 'yellow',
                'text': 'No bullet points set. Used suggested bullet points.',
                'time_show': 250,
                'time_hide': 250,
                'time_duration': 3000
            })
            split1 = [];
            split2 = [];
            split3 = [];
            for (var i = 1; i <= 4; i++) {
                if ($('#suggestedSplitter' + i).text().length > 0) {
                    if (i <= 2) split1.push($('#suggestedSplitter' + i).text());
                    else if (i == 3) split2.push($('#suggestedSplitter' + i).text());
                    else split3.push($('#suggestedSplitter' + i).text());
                }
            }
        }
        userText=splitterProcess(userText,bullet,split1,split2,split3);
        var userTextArray = userText.split('\n');
        var elementsToRemove = [];
        for (var i = 0; i < userTextArray.length; i++) {
            while (userTextArray[i].indexOf(' ') == 0) {
                userTextArray[i] = userTextArray[i].replace(' ', '');
            }
            if (userTextArray[i] == "") {
                elementsToRemove.push(i);
            }
        }
        for (var i = elementsToRemove.length - 1; i >= 0; i--) {
            userTextArray.splice(elementsToRemove[i], 1);
        }
        var userTextArray_joined = userTextArray.join('\n');
        userTextArray_joined = userTextArray_joined.replace(/PLA.'CEHOLDER/g, '');
        return userTextArray_joined;
    }
    function splitterReplace(splitters,text,replacer,replacerRepeat){
        for (splitter in splitters) {
            while (splitters[splitter] != "NUM" && splitters[splitter] != "" && text.indexOf(splitters[splitter]) != -1) {
                text = text.replace(splitters[splitter], "\n"+replacer.repeat(replacerRepeat));
            }
        }
        return text;
    }
    function splitterReplace_Num(text,numDelim,replacer,replacerRepeat){
        var keepReplacing=true;
        while (keepReplacing) {
            keepReplacing = false;
            for (var i = 100; i > 0; i--) {
                if (text.indexOf(i + numDelim) != -1) keepReplacing = true;
                text = text.replace(i + numDelim, "\n"+replacer.repeat(replacerRepeat));
            }
        }
        return text;
    }
    function splitterProcess(userText,replacer, split1, split2, split3){
        split1=splitter_detectNumbers(split1);
        split2=splitter_detectNumbers(split2);
        split3=splitter_detectNumbers(split3);

        var numDelim = $('#numDelim').val();
        var splitterCount = 0;
        if (split3.length > 0 && split3[0] != "") {
            splitterCount = 3;
        } else if (split2.length > 0 && split2[0] != "") {
            splitterCount = 2;
        } else if (split1.length > 0 && split1[0] != "") {
            splitterCount = 1;
        }
        if (splitterCount > 2) {
            userText=splitterReplace(split3,userText,replacer,3);
        }
        if (splitterCount > 2 && split3.indexOf("NUM") != -1) {
            userText=splitterReplace_Num(userText,numDelim,replacer,3);
        }

        if (splitterCount > 1) {
            userText=splitterReplace(split2,userText,replacer,2);
        }
        if (splitterCount > 1 && split2.indexOf("NUM") != -1) {
            userText=splitterReplace_Num(userText,numDelim,replacer,2);
        }

        if (splitterCount > 0) {
            userText=splitterReplace(split1,userText,replacer,1);
        }
        if (splitterCount > 0 && split1.indexOf("NUM") != -1) {
            userText=splitterReplace_Num(userText,numDelim,replacer,1);
        }
        return userText;
    }
    
    //drag and drop
    var lastTarget = null;

    function isFile(evt) {
        var dt = evt.dataTransfer;

        for (var i = 0; i < dt.types.length; i++) {
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
            var fileName = (e.dataTransfer.files[0]) ? e.dataTransfer.files[0].name : "Click to select file (or drag and drop)";
            userPDF = e.dataTransfer.files[0];
            if (userPDF.type != "application/pdf") {
                console.error(userPDF.name, "is not a pdf file.")
                alert(userPDF.name + " is not a pdf file.");
                return;
            }

            $('#filename').text(fileName);

            if(DEBUG)console.log('The file "' + fileName + '" has been selected.');
            showBanner({
                'color': 'yellow',
                'text': 'Detecting Bullet Points...',
                'time_show': 250
            })
            detectSplitters();
        }
    });
});

