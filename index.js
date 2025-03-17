import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和设置
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
    $("#scroll-up").on("click", scrollToFirstMessage);
    $("#scroll-down").on("click", scrollToLastMessage);
    $("#jump-to-floor").on("click", showJumpToFloorPopup);
    $("#advanced-settings").on("click", showAdvancedSettingsPopup);
    $("#search-button").on("click", handleSearchButtonClick);
    $("#keyword-search").on("input", handleKeywordInput);
}

// 滚动到最早消息
function scrollToFirstMessage() {
    const context = getContext();
    const chat = context.chat;
    if (chat.length > 0) {
        scrollToMessage(0); // mesid 从 0 开始
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

// 显示跳转指定楼层弹窗
async function showJumpToFloorPopup() {
    const popupHtml = `
        <div>
            <input type="number" id="floor-input" placeholder="输入楼层号">
            <div id="floor-info"></div>
        </div>
    `;
    const popup = new Popup(popupHtml, POPUP_TYPE.INPUT);
    popup.show();

    $("#floor-input").on("input", handleFloorInput);
    $("#floor-input").on("blur", () => {
        const floor = parseInt($("#floor-input").val());
        if (!isNaN(floor)) {
            scrollToMessage(floor);
            popup.close();
        }
    });
}

// 处理楼层输入
function handleFloorInput() {
    const floor = parseInt($("#floor-input").val());
    if (!isNaN(floor)) {
        const context = getContext();
        const chat = context.chat;
        if (floor >= 0 && floor < chat.length) {
            const message = chat[floor];
            $("#floor-info").text(`楼层 ${floor}: ${message.mes.substring(0, 50)}...`);
        } else {
            $("#floor-info").text("楼层不存在");
        }
    } else {
        $("#floor-info").text("");
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
    if (extension_settings[extensionName].realTimeRendering) {
        const keyword = $("#keyword-search").val();
        searchMessages(keyword);
    }
}

// 处理搜索按钮点击
function handleSearchButtonClick() {
    if (extension_settings[extensionName].realTimeRendering) {
        $("#keyword-search").val(""); // 清空输入框
        clearSearchHighlights();
    } else {
        const keyword = $("#keyword-search").val();
        searchMessages(keyword);
    }
}

// 检索消息并高亮关键词
function searchMessages(keyword) {
    if (!keyword) {
        clearSearchHighlights();
        return;
    }
    const context = getContext();
    const chat = context.chat;
    let found = false;
    chat.forEach((message, index) => {
        if (message.mes.includes(keyword)) {
            found = true;
            if (extension_settings[extensionName].highlightKeywords) {
                highlightMessage(index, keyword);
            }
            scrollToMessage(index); // 滚动到第一个匹配的消息
            return; // 只滚动到第一个匹配项
        }
    });
    if (!found) {
        toastr.error("未找到匹配的消息");
    }
}

// 高亮指定消息中的关键词
function highlightMessage(mesId, keyword) {
    const messageElement = $(`#chat .mes[mesid="${mesId}"] .mes_text`);
    if (messageElement.length > 0) {
        const text = messageElement.text();
        const highlightedText = text.replace(new RegExp(keyword, "gi"), match => `<span class="highlight">${match}</span>`);
        messageElement.html(highlightedText);
    }
}

// 清除高亮
function clearSearchHighlights() {
    $("#chat .mes .mes_text .highlight").each(function() {
        $(this).replaceWith($(this).text());
    });
}