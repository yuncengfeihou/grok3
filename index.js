import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和默认设置
const extensionName = "message-navigator";
const defaultSettings = {
    realTimeRendering: true,  // 默认启用实时渲染
    highlightKeywords: true   // 默认启用关键词高亮
};

// 加载插件设置
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
}

// 创建插件 UI
jQuery(async () => {
    const settingsHtml = `
        <div id="message-navigator">
            <div class="keyword-search-area">
                <input type="text" id="keyword-search" placeholder="输入关键词">
                <button id="search-button">[清空]</button>
                <div id="search-results"></div>
            </div>
            <div class="quick-scroll-area">
                <button id="scroll-up">↑</button>
                <button id="jump-to-floor">[跳转指定楼层]</button>
                <button id="scroll-down">↓</button>
            </div>
            <button id="advanced-settings">[高级检索设置]</button>
        </div>
    `;
    $("body").append(settingsHtml); // 将 UI 添加到页面
    await loadSettings();
    updateSearchButtonText();
    bindEvents();
});

// 更新搜索按钮文本
function updateSearchButtonText() {
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    $("#search-button").text(realTimeRendering ? "[清空]" : "[确定]");
}

// 绑定事件
function bindEvents() {
    $("#scroll-up").on("click", scrollToFirstLoadedMessage);
    $("#scroll-down").on("click", scrollToLastMessage);
    $("#jump-to-floor").on("click", () => showJumpToFloorPopup());
    $("#advanced-settings").on("click", showAdvancedSettingsPopup);
    $("#search-button").on("click", handleSearchButtonClick);
    $("#keyword-search").on("input", handleKeywordInput);
}

// 滚动到最早的已加载消息
function scrollToFirstLoadedMessage() {
    const loadedMessages = $("#chat .mes");
    if (loadedMessages.length > 0) {
        const firstMesId = parseInt(loadedMessages.first().attr("mesid"));
        scrollToMessage(firstMesId);
    } else {
        toastr.error("没有已加载的消息");
    }
}

// 滚动到最新消息
function scrollToLastMessage() {
    const context = getContext();
    const chat = context.chat;
    if (chat.length > 0) {
        scrollToMessage(chat.length - 1); // 最后一条消息的 mesid
    }
}

// 滚动到指定 mesid 的消息
function scrollToMessage(mesId) {
    const messageElement = $(`#chat .mes[mesid="${mesId}"]`);
    if (messageElement.length > 0) {
        messageElement[0].scrollIntoView({ behavior: 'smooth' });
    } else {
        toastr.error("消息未加载或不存在");
    }
}

// 显示跳转指定楼层弹窗（支持传入 mesId）
async function showJumpToFloorPopup(selectedMesId = null) {
    const popupHtml = `
        <div class="jump-to-floor-container">
            <input type="number" id="floor-input" placeholder="输入楼层号">
            <div id="floor-info" style="cursor: pointer;"></div>
            <div id="full-message-container" style="display: none; max-height: 80vh; overflow-y: auto; padding: 10px; border: 1px solid #ddd;"></div>
            <div class="popup-buttons">
                <button id="ok-button">[OK]</button>
                <button id="jump-button" style="display: none;">[跳转]</button>
            </div>
        </div>
    `;
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();

    const $floorInput = $("#floor-input");
    const $floorInfo = $("#floor-info");
    const $fullMessageContainer = $("#full-message-container");
    const $jumpButton = $("#jump-button");

    // 输入楼层号时更新预览
    $floorInput.on("input", function() {
        const floor = parseInt($(this).val());
        if (!isNaN(floor)) {
            const context = getContext();
            const chat = context.chat;
            if (floor >= 0 && floor < chat.length) {
                $floorInfo.text(`楼层 ${floor}: ${chat[floor].mes.substring(0, 50)}...`);
                $fullMessageContainer.text(chat[floor].mes).show();
                $fullMessageContainer.css({ height: "80vh" }); // 扩展到屏幕高度的 80%
                $jumpButton.show();
            } else {
                $floorInfo.text("楼层不存在");
                $fullMessageContainer.hide();
                $jumpButton.hide();
            }
        } else {
            $floorInfo.text("");
            $fullMessageContainer.hide();
            $jumpButton.hide();
        }
    });

    // 点击楼层预览时跳转
    $floorInfo.on("click", function() {
        const floor = parseInt($floorInput.val());
        if (!isNaN(floor)) {
            scrollToMessage(floor);
            popup.close();
        }
    });

    // 点击跳转按钮时滚动到消息
    $jumpButton.on("click", function() {
        const floor = parseInt($floorInput.val());
        if (!isNaN(floor)) {
            scrollToMessage(floor);
            popup.close();
        }
    });

    // 如果有传入的 mesId（从检索结果点击时），直接显示对应消息
    if (selectedMesId !== null) {
        const context = getContext();
        const chat = context.chat;
        if (selectedMesId >= 0 && selectedMesId < chat.length) {
            $floorInput.val(selectedMesId);
            $floorInfo.text(`楼层 ${selectedMesId}: ${chat[selectedMesId].mes.substring(0, 50)}...`);
            $fullMessageContainer.text(chat[selectedMesId].mes).show();
            $fullMessageContainer.css({ height: "80vh" }); // 扩展到屏幕高度的 80%
            $jumpButton.show();
        }
    }
}

// 显示高级检索设置弹窗
async function showAdvancedSettingsPopup() {
    const realTimeChecked = extension_settings[extensionName].realTimeRendering ? "checked" : "";
    const highlightChecked = extension_settings[extensionName].highlightKeywords ? "checked" : "";
    const popupHtml = `
        <div>
            <label><input type="checkbox" id="real-time-rendering" ${realTimeChecked}> 实时渲染</label>
            <label><input type="checkbox" id="highlight-keywords" ${highlightChecked}> 关键词提亮</label>
            <button id="save-settings">保存</button>
        </div>
    `;
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();

    $("#save-settings").on("click", () => {
        extension_settings[extensionName].realTimeRendering = $("#real-time-rendering").prop("checked");
        extension_settings[extensionName].highlightKeywords = $("#highlight-keywords").prop("checked");
        saveSettingsDebounced();
        updateSearchButtonText();
        popup.close();
    });
}

// 处理关键词输入（实时检索）
function handleKeywordInput() {
    const keyword = $("#keyword-search").val();
    if (keyword) {
        const context = getContext();
        const chat = context.chat;
        const results = [];
        chat.forEach((message, index) => {
            if (message.mes.includes(keyword)) {
                results.push({ mesId: index, text: message.mes.substring(0, 50) + "..." });
            }
        });
        const resultsContainer = $("#search-results");
        resultsContainer.empty();
        if (results.length > 0) {
            results.forEach(result => {
                resultsContainer.append(
                    `<div class="search-result" data-mesid="${result.mesId}">${result.text}</div>`
                );
            });
            $(".search-result").on("click", function() {
                const mesId = $(this).data("mesid");
                showJumpToFloorPopup(mesId); // 点击时显示弹窗并传入 mesId
            });
        } else {
            resultsContainer.text("未找到匹配的消息");
        }
    } else {
        $("#search-results").empty();
    }
}

// 处理搜索按钮点击
function handleSearchButtonClick() {
    if (extension_settings[extensionName].realTimeRendering) {
        $("#keyword-search").val(""); // 清空输入框
        $("#search-results").empty(); // 清空检索结果
    } else {
        handleKeywordInput(); // 触发检索
    }
}
