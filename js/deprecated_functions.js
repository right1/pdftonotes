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