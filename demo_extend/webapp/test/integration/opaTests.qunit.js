sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'demoextend/test/integration/FirstJourney',
		'demoextend/test/integration/pages/headerList',
		'demoextend/test/integration/pages/headerObjectPage'
    ],
    function(JourneyRunner, opaJourney, headerList, headerObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('demoextend') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheheaderList: headerList,
					onTheheaderObjectPage: headerObjectPage
                }
            },
            opaJourney.run
        );
    }
);