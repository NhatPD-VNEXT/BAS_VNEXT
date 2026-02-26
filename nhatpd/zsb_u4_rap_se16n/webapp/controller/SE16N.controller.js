sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/DatePicker",
    "sap/m/TimePicker",
    "sap/m/DateTimePicker",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/odata/type/Date",
    "sap/ui/model/odata/type/TimeOfDay",
    "sap/ui/model/odata/type/DateTimeOffset"
], (Controller, Table, Column, VBox, HBox, Label, Input, Button, DatePicker, TimePicker, DateTimePicker, MessageBox, MessageToast, Filter, FilterOperator, ODataDateType, ODataTimeOfDayType, ODataDateTimeOffsetType) => {
    "use strict";

    return Controller.extend("zsbu4rapse16n.controller.SE16N", {
        onInit() {
            this._sUpdateGroupId = "se16nChanges";
        },

        onUppercaseInput: function (oEvent) {
            const sValue = oEvent.getParameter("value");
            oEvent.getSource().setValue(sValue.toUpperCase());
        },

        onExecute: async function () {
            const tableInput = this.byId("tableInput");
            const tableName = tableInput.getValue().trim();

            if (!tableName) {
                MessageBox.error("Please enter a table name", {
                    title: "Error"
                });
                return;
            }

            try {
                const sEntitySet = await this._resolveEntitySetFromInput(tableName);

                if (!sEntitySet) {
                    MessageBox.error(`No matching entity set found for table '${tableName}'.`, {
                        title: "Not Found"
                    });
                    return;
                }

                this.clearExistingSmartTable();
                await this.createDynamicSmartTable(sEntitySet);
                MessageToast.show(`Loaded table for entity set '${sEntitySet}'.`);
            } catch (oError) {
                MessageBox.error(oError.message || "Unable to load metadata for table.", {
                    title: "Error"
                });
            }
        },

        clearExistingSmartTable: function () {
            const oContainer = this.byId("smartTableContainer");
            if (oContainer) {
                oContainer.destroyItems();
            }
            this._mDynamicFilterInputs = {};
        },

        createDynamicSmartTable: async function (sEntitySet) {
            const oModel = this.getView().getModel();
            const oMetaModel = oModel.getMetaModel();
            const oContainer = this.byId("smartTableContainer");

            const oEntitySet = await oMetaModel.requestObject(`/${sEntitySet}`);
            if (!oEntitySet || !oEntitySet.$Type) {
                throw new Error(`Entity metadata for '${sEntitySet}' is not available.`);
            }

            const oEntityType = await oMetaModel.requestObject(`/${oEntitySet.$Type}/`);
            if (!oEntityType) {
                throw new Error(`Entity type metadata for '${sEntitySet}' is not available.`);
            }

            const aLineItemFields = await this._getLineItemFields(oMetaModel, oEntitySet.$Type);
            if (!aLineItemFields.length) {
                throw new Error(`LineItem annotation not found for '${sEntitySet}'.`);
            }

            const aSelectionFields = await this._getSelectionFields(oMetaModel, oEntitySet.$Type);
            const aKeyFields = this._getEntityKeyFields(oEntityType);
            const oKeyFieldSet = new Set(aKeyFields);

            const aAvailableFields = new Set(this._getAllPropertyFields(oEntityType));
            const aTableFields = aLineItemFields.filter((sField) => aAvailableFields.has(sField));
            const aFilterFields = aSelectionFields.filter((sField) => aAvailableFields.has(sField));

            const oTable = new Table(this.createId("dynamicTable"), {
                header: sEntitySet,
                visibleRowCountMode: "Auto",
                selectionMode: "MultiToggle",
                selectionBehavior: "RowSelector"
            });

            oTable.data("keyFields", aKeyFields);

            aTableFields.forEach((sPropertyName) => {
                oTable.addColumn(new Column({
                    label: new Label({
                        text: sPropertyName,
                        required: oKeyFieldSet.has(sPropertyName)
                    }),
                    template: this._createCellTemplate(sPropertyName, oEntityType[sPropertyName], {
                        isKeyField: oKeyFieldSet.has(sPropertyName)
                    }),
                    sortProperty: sPropertyName,
                    filterProperty: sPropertyName
                }));
            });

            oTable.setModel(oModel);
            oTable.bindRows({
                path: `/${sEntitySet}`,
                parameters: {
                    $$updateGroupId: this._sUpdateGroupId
                }
            });

            const oFilterSection = this._createDynamicFilterSection(aFilterFields, oTable);
            const oActionSection = this._createTableActionSection(oTable, oModel);

            oContainer.addItem(oFilterSection);
            oContainer.addItem(oActionSection);
            oContainer.addItem(oTable);
        },

        _createTableActionSection: function (oTable, oModel) {
            const oActionRow = new HBox({
                justifyContent: "End",
                class: "sapUiTinyMarginBottom"
            });

            const oCreateButton = new Button({
                text: "Create",
                type: "Accept",
                press: () => {
                    this._onCreateRow(oTable);
                }
            });

            const oDeleteButton = new Button({
                text: "Delete",
                type: "Reject",
                class: "sapUiTinyMarginBegin",
                press: () => {
                    this._onDeleteRows(oTable);
                }
            });

            const oSaveButton = new Button({
                text: "Save",
                type: "Emphasized",
                class: "sapUiTinyMarginBegin",
                press: async () => {
                    try {
                        if (!oModel.hasPendingChanges(this._sUpdateGroupId)) {
                            MessageToast.show("No changes to save.");
                            return;
                        }

                        if (!this._validateRequiredKeyFields(oTable)) {
                            return;
                        }

                        await oModel.submitBatch(this._sUpdateGroupId);
                        MessageToast.show("Data saved successfully.");
                    } catch (oError) {
                        MessageBox.error(this._extractBackendErrorMessage(oError, "Save failed."), {
                            title: "Error"
                        });
                    }
                }
            });

            oActionRow.addItem(oCreateButton);
            oActionRow.addItem(oDeleteButton);
            oActionRow.addItem(oSaveButton);

            return oActionRow;
        },

        _onCreateRow: function (oTable) {
            const oBinding = oTable.getBinding("rows");
            if (!oBinding || !oBinding.create) {
                MessageBox.error("Create is not available for this table.", {
                    title: "Error"
                });
                return;
            }

            oBinding.create({}, false);

            oTable.clearSelection();
            oTable.setFirstVisibleRow(0);
            oTable.setSelectedIndex(0);
            MessageToast.show("New row created. Fill data and press Save.");
        },

        _onDeleteRows: async function (oTable) {
            const aSelectedIndices = oTable.getSelectedIndices();
            if (!aSelectedIndices.length) {
                MessageToast.show("Please select at least one row.");
                return;
            }

            const aDeletePromises = aSelectedIndices
                .map((iIndex) => oTable.getContextByIndex(iIndex))
                .filter(Boolean)
                .map((oContext) => oContext.delete(this._sUpdateGroupId));

            try {
                await Promise.all(aDeletePromises);
                oTable.clearSelection();
                MessageToast.show("Selected row(s) marked for deletion. Press Save.");
            } catch (oError) {
                MessageBox.error(this._extractBackendErrorMessage(oError, "Delete failed."), {
                    title: "Error"
                });
            }
        },

        _extractBackendErrorMessage: function (oError, sFallback) {
            const sDefault = sFallback || "Request failed.";
            if (!oError) {
                return sDefault;
            }

            if (oError.message) {
                return oError.message;
            }

            try {
                const sResponseText = oError.responseText || (oError.cause && oError.cause.responseText);
                if (sResponseText) {
                    const oResponse = JSON.parse(sResponseText);
                    return oResponse.error && oResponse.error.message && oResponse.error.message.value || sDefault;
                }
            } catch (e) {
            }

            return sDefault;
        },

        _createDynamicFilterSection: function (aFilterFields, oTable) {
            const oFilterBox = new VBox({
                class: "sapUiSmallMarginBottom"
            });
            const oFieldsRow = new HBox({
                wrap: "Wrap",
                class: "sapUiTinyMarginBottom"
            });
            const oActionsRow = new HBox({
                class: "sapUiTinyMarginTop"
            });

            this._mDynamicFilterInputs = {};

            aFilterFields.forEach((sFieldName) => {
                const oInput = new Input({
                    width: "14rem",
                    placeholder: sFieldName,
                    class: "sapUiTinyMarginEnd sapUiTinyMarginBottom"
                });

                this._mDynamicFilterInputs[sFieldName] = oInput;
                oFieldsRow.addItem(oInput);
            });

            const oGoButton = new Button({
                text: "GO",
                type: "Emphasized",
                press: () => {
                    this._applyDynamicFilters(oTable);
                }
            });

            oActionsRow.addItem(oGoButton);

            oFilterBox.addItem(new Label({ text: "Filters (from SelectionFields)" }));
            oFilterBox.addItem(oFieldsRow);
            oFilterBox.addItem(oActionsRow);

            return oFilterBox;
        },

        _applyDynamicFilters: function (oTable) {
            const aFilters = [];

            Object.entries(this._mDynamicFilterInputs || {}).forEach(([sFieldName, oInput]) => {
                const sValue = (oInput.getValue() || "").trim();
                if (sValue) {
                    aFilters.push(new Filter({
                        path: sFieldName,
                        operator: FilterOperator.Contains,
                        value1: sValue
                    }));
                }
            });

            const oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter(aFilters);
            }
        },

        _createCellTemplate: function (sPropertyName, oPropertyDefinition, oOptions) {
            const sType = (oPropertyDefinition && oPropertyDefinition.$Type) || "";
            const bIsKeyField = !!(oOptions && oOptions.isKeyField);
            const vEditable = this._getCellEditableSetting(bIsKeyField);
            const vRequired = this._getCellRequiredSetting(bIsKeyField);
            const vValueState = this._getRequiredValueStateSetting(sPropertyName, bIsKeyField);
            let oTemplateControl;

            if (sType === "Edm.Date") {
                oTemplateControl = new DatePicker({
                    value: {
                        path: sPropertyName,
                        type: new ODataDateType()
                    },
                    width: "100%",
                    displayFormat: "medium",
                    editable: vEditable,
                    required: vRequired,
                    valueState: vValueState
                });
                return oTemplateControl;
            }

            if (sType === "Edm.TimeOfDay") {
                oTemplateControl = new TimePicker({
                    value: {
                        path: sPropertyName,
                        type: new ODataTimeOfDayType()
                    },
                    width: "100%",
                    displayFormat: "HH:mm:ss",
                    editable: vEditable,
                    required: vRequired,
                    valueState: vValueState
                });
                return oTemplateControl;
            }

            if (sType === "Edm.DateTimeOffset") {
                oTemplateControl = new DateTimePicker({
                    value: {
                        path: sPropertyName,
                        type: new ODataDateTimeOffsetType({
                            style: "medium"
                        }, {
                            precision: oPropertyDefinition.$Precision
                        })
                    },
                    width: "100%",
                    displayFormat: "medium",
                    editable: vEditable,
                    required: vRequired,
                    valueState: vValueState
                });
                return oTemplateControl;
            }

            oTemplateControl = new Input({
                value: `{${sPropertyName}}`,
                editable: vEditable,
                required: vRequired,
                valueState: vValueState
            });

            return oTemplateControl;
        },

        _getCellEditableSetting: function (bIsKeyField) {
            if (!bIsKeyField) {
                return true;
            }

            return "{= ${@$ui5.context.isTransient} === true }";
        },

        _getCellRequiredSetting: function (bIsKeyField) {
            if (!bIsKeyField) {
                return false;
            }

            return "{= ${@$ui5.context.isTransient} === true }";
        },

        _getRequiredValueStateSetting: function (sPropertyName, bIsKeyField) {
            if (!bIsKeyField) {
                return "None";
            }

            return "{= ${@$ui5.context.isTransient} === true && !${" + sPropertyName + "} ? 'Error' : 'None' }";
        },

        _validateRequiredKeyFields: function (oTable) {
            const oBinding = oTable && oTable.getBinding("rows");
            const aKeyFields = (oTable && oTable.data("keyFields")) || [];

            if (!oBinding || !aKeyFields.length) {
                return true;
            }

            const iLength = oBinding.getLength();
            const aContexts = oBinding.getContexts(0, iLength);

            for (const oContext of aContexts) {
                if (!oContext || !oContext.isTransient || oContext.isTransient() !== true) {
                    continue;
                }

                for (const sKeyField of aKeyFields) {
                    const vValue = oContext.getProperty(sKeyField);
                    const bMissingString = typeof vValue === "string" && !vValue.trim();
                    const bMissingValue = vValue === null || vValue === undefined || bMissingString;

                    if (bMissingValue) {
                        MessageBox.warning(`Please input required key field '${sKeyField}' before Save.`, {
                            title: "Required Field"
                        });
                        return false;
                    }
                }
            }

            return true;
        },

        _getEntityKeyFields: function (oEntityType) {
            const aKeys = (oEntityType && Array.isArray(oEntityType.$Key)) ? oEntityType.$Key : [];

            return aKeys
                .map((vKey) => {
                    if (typeof vKey === "string") {
                        return vKey;
                    }

                    if (vKey && typeof vKey === "object") {
                        return Object.values(vKey)[0];
                    }

                    return null;
                })
                .filter((sKey) => typeof sKey === "string" && !!sKey);
        },

        _getLineItemFields: async function (oMetaModel, sEntityTypePath) {
            const aLineItems = await this._requestAnnotationValue(oMetaModel, sEntityTypePath, [
                "com.sap.vocabularies.UI.v1.LineItem",
                "SAP__UI.LineItem"
            ]);

            if (!Array.isArray(aLineItems)) {
                return [];
            }

            return aLineItems
                .map((oRecord) => {
                    const oValue = oRecord && oRecord.Value;
                    return (oValue && (oValue.$Path || oValue.Path)) || null;
                })
                .filter(Boolean);
        },

        _getSelectionFields: async function (oMetaModel, sEntityTypePath) {
            const aSelectionFields = await this._requestAnnotationValue(oMetaModel, sEntityTypePath, [
                "com.sap.vocabularies.UI.v1.SelectionFields",
                "SAP__UI.SelectionFields"
            ]);

            if (!Array.isArray(aSelectionFields)) {
                return [];
            }

            return aSelectionFields
                .map((oField) => oField && (oField.$PropertyPath || oField.PropertyPath || oField))
                .filter((sField) => typeof sField === "string" && !!sField);
        },

        _getAllPropertyFields: function (oEntityType) {
            return Object.entries(oEntityType)
                .filter(([sPropertyName, oPropertyDefinition]) => {
                    return !sPropertyName.startsWith("$") && oPropertyDefinition && oPropertyDefinition.$kind === "Property";
                })
                .map(([sPropertyName]) => sPropertyName);
        },

        _requestAnnotationValue: async function (oMetaModel, sEntityTypePath, aPossibleTerms) {
            for (const sTerm of aPossibleTerms) {
                const vValue = await oMetaModel.requestObject(`/${sEntityTypePath}@${sTerm}`);
                if (vValue) {
                    return vValue;
                }
            }

            return null;
        },

        _resolveEntitySetFromInput: async function (sInputName) {
            const oModel = this.getView().getModel();
            if (!oModel) {
                throw new Error("Main OData model is not available.");
            }

            const oMetaModel = oModel.getMetaModel();
            const sContainerName = await oMetaModel.requestObject("/$EntityContainer");
            const oContainer = await oMetaModel.requestObject(`/${sContainerName}/`);

            if (!oContainer) {
                throw new Error("Entity container metadata is not available.");
            }

            const sNormalizedInput = this._normalizeName(sInputName);

            for (const [sName, oDefinition] of Object.entries(oContainer)) {
                if (!oDefinition || oDefinition.$kind !== "EntitySet") {
                    continue;
                }

                const sNormalizedEntitySet = this._normalizeName(sName);
                const sTypeName = (oDefinition.$Type || "").split(".").pop() || "";
                const sNormalizedTypeName = this._normalizeName(sTypeName.replace(/Type$/, ""));

                if (sNormalizedEntitySet === sNormalizedInput || sNormalizedTypeName === sNormalizedInput) {
                    return sName;
                }
            }

            return null;
        },

        _normalizeName: function (sValue) {
            return (sValue || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        }
    });
});