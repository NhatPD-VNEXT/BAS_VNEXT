sap.ui.define([
	"sap/m/MessageToast"
], function(MessageToast) {
	'use strict';

	/**
	 * Splits a comma-separated string into an array of trimmed, non-empty values.
	 */
	function splitCommaSeparated(value) {
		if (typeof value !== "string") {
			return [];
		}
		return value
			.split(',')
			.map(function(part) { return part.trim(); })
			.filter(function(part) { return part.length > 0; });
	}

	/**
	 * Builds navigation parameters for CrossApplicationNavigation.
	 * Adjust semantic object and action to your target standard app if needed.
	 */
	function buildNavigationConfig(accountingDocuments, companyCode, fiscalYear) {
		return {
			target: {
				semanticObject: "AccountingDocument",
				action: "extendJournalEntry"
			},
			params: (function() {
				var oParams = {
					// Multi-value supported by FLP as array
					AccountingDocument: accountingDocuments
				};
				if (companyCode) {
					oParams.CompanyCode = companyCode;
				}
				if (fiscalYear) {
					oParams.FiscalYear = fiscalYear;
				}
				return oParams;
			})()
		};
	}

	return {
		/**
		 * Press handler for Demo_Navigation button.
		 * - Reads `AccountingDocument` from the row context
		 * - Splits by comma into multiple values
		 * - Triggers cross-app navigation with multi-value parameter
		 */
		onPress: function(oEvent) {
            console.log("Debug");
			var oSource = oEvent.getSource();
			var oCtx = oSource.getBindingContext && oSource.getBindingContext();
			if (!oCtx) {
				MessageToast.show("No context available for navigation.");
				return;
			}

			var sAccountingDocument = oCtx.getProperty && oCtx.getProperty("AccountingDocument");
			var sCompanyCode = oCtx.getProperty && oCtx.getProperty("CompanyCode1");
			var sFiscalYear = oCtx.getProperty && oCtx.getProperty("FiscalYear");
			var aDocs = splitCommaSeparated(sAccountingDocument);
			if (aDocs.length === 0) {
				MessageToast.show("No AccountingDocument to navigate.");
				return;
			}

			// Obtain CrossApplicationNavigation service and navigate
			if (sap && sap.ushell && sap.ushell.Container && sap.ushell.Container.getServiceAsync) {
					sap.ushell.Container.getServiceAsync("CrossApplicationNavigation")
						.then(function(oCrossAppNav) {
							var oConfig = buildNavigationConfig(aDocs, sCompanyCode, sFiscalYear);
							oCrossAppNav.toExternal(oConfig);
						})
					.catch(function() {
						MessageToast.show("CrossApplicationNavigation service not available.");
					});
			} else {
				MessageToast.show("Shell services not available.");
			}
		}
	};
});
