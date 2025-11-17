sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'zdemonavigation',
            componentId: 'FI_DOCObjectPage',
            contextPath: '/FI_DOC'
        },
        CustomPageDefinitions
    );
});