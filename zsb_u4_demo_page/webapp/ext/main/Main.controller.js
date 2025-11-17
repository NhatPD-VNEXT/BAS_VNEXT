sap.ui.define(
    [
        'sap/fe/core/PageController',
        'sap/m/MessageToast',
        'sap/ui/model/json/JSONModel',
        'sap/ui/table/Column',
        'sap/m/Label',
        'sap/m/Text'
    ],
    function (PageController, MessageToast, JSONModel, UiTableColumn, Label, Text) {
        'use strict';

        return PageController.extend('zsbu4demopage.ext.main.Main', {
            onInit: function () {
                // Model local chứa dữ liệu hiển thị trong table
                this.getView().setModel(new JSONModel({ rows: [] }), "local");
            },

            onExecute: async function () {
                var oInput = this.byId('tableInput');
                var sTableName = oInput ? oInput.getValue().trim() : '';

                if (!sTableName) {
                    MessageToast.show("Please enter table name!");
                    return;
                }

                var oTable = this.byId("dynamicTable");
                // Hiển thị trạng thái loading trên Grid Table
                oTable.setBusy(true);

                try {
                    // --- 1. Lấy metadata để build columns ---
                    const sMetaUri =
                        "/sap/opu/odata4/sap/zsb_u4_demo_extend/srvd/sap/zsd_demo_extend/0001/header/" +
                        "SAP__self.getComponent(tablename='" + sTableName + "')";
                    const responseMeta = await fetch(sMetaUri, { headers: { "Accept": "application/json" } });

                    if (!responseMeta.ok) throw new Error("HTTP error " + responseMeta.status);

                    const oMetaJson = await responseMeta.json();
                    const aColumns = oMetaJson.value || [];

                    // Chuẩn bị bảng: xoá cột cũ, unbind rows
                    oTable.unbindRows();
                    oTable.destroyColumns();

                    aColumns.forEach(function (col) {
                        oTable.addColumn(new UiTableColumn({
                            label: new Label({ text: col.NAME }),
                            template: new Text({ text: "{local>" + col.NAME + "}" })
                        }));
                    });

                    // --- 2. Lấy dữ liệu thực tế ---
                    const sDataUri =
                        "/sap/opu/odata4/sap/zsb_u4_demo_extend/srvd/sap/zsd_demo_extend/0001/header/" +
                        "SAP__self.getData(tablename='" + sTableName + "')";
                    const responseData = await fetch(sDataUri, { headers: { "Accept": "application/json" } });

                    if (!responseData.ok) throw new Error("HTTP error " + responseData.status);

                    const oDataJson = await responseData.json();

                    // Backend trả về value[].data (string JSON) → cần parse
                    let aRows = [];
                    if (oDataJson.value && Array.isArray(oDataJson.value)) {
                        oDataJson.value.forEach(entry => {
                            if (entry.data) {
                                try {
                                    const parsed = JSON.parse(entry.data);
                                    if (Array.isArray(parsed)) {
                                        aRows = aRows.concat(parsed);
                                    }
                                } catch (e) {
                                    console.error("❌ Parse error:", e);
                                }
                            }
                        });
                    }

                    console.log("🔹 Parsed table data:", aRows);

                    // --- 3. Gán dữ liệu vào model & bind rows ---
                    this.getView().getModel("local").setProperty("/rows", aRows);
                    oTable.bindRows({ path: "local>/rows" });

                    MessageToast.show("Loaded " + aRows.length + " rows");

                } catch (err) {
                    MessageToast.show("Error: " + err.message);
                    console.error(err);
                } finally {
                    // Tắt loading
                    oTable.setBusy(false);
                }
            },
            onUppercaseInput: function (oEvent) {
                var oSource = oEvent.getSource();
                var sValue = oSource.getValue() || '';
                var sUpper = sValue.toUpperCase();
                if (sUpper !== sValue) {
                    oSource.setValue(sUpper);
                }
            },

            onDeleteSelected: function () {
                var oTable = this.byId("dynamicTable");
                var aSelectedIdx = oTable.getSelectedIndices();
                if (!aSelectedIdx || aSelectedIdx.length === 0) {
                    MessageToast.show("No rows selected");
                    return;
                }

                // Lấy dữ liệu hiện tại
                var oModel = this.getView().getModel("local");
                var aRows = oModel.getProperty("/rows") || [];

                // Xoá từ cuối về đầu để không lệch index
                aSelectedIdx.sort(function (a, b) { return b - a; }).forEach(function (iIdx) {
                    if (iIdx > -1 && iIdx < aRows.length) {
                        aRows.splice(iIdx, 1);
                    }
                });

                oModel.setProperty("/rows", aRows);
                oTable.clearSelection();
                MessageToast.show("Deleted " + aSelectedIdx.length + " row(s)");
            }
        });
    }
);
