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
    $("#jump-to-floor").on("click", showJumpToFloorPopup);
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

// 显示跳转指定楼层弹窗
async function showJumpToFloorPopup() {
    let selectedFloor = null; // 用于存储当前选中的楼层
    let fullMessageText = "";   // 用于存储完整消息文本

    const popupHtml = `
        <div>
            <input type="number" id="floor-input" placeholder="输入楼层号">
            <div id="floor-info-preview" style="cursor: pointer;"></div>
            <div id="full-message-container" style="display: none; max-height: 80vh; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-top: 5px;">
                <pre id="full-message-text" style="white-space: pre-wrap; word-wrap: break-word;"></pre>
            </div>
            <div style="margin-top: 10px;">
                <button id="jump-ok-button">OK</button>
                <button id="jump-button" style="margin-left: 5px;">跳转</button>
            </div>
        </div>
    `;
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();

    const $floorInput = $("#floor-input");
    const $floorInfoPreview = $("#floor-info-preview");
    const $fullMessageContainer = $("#full-message-container");
    const $fullMessageText = $("#full-message-text");
    const $jumpOkButton = $("#jump-ok-button");
    const $jumpButton = $("#jump-button");


    $floorInput.on("input", function() {
        const floor = parseInt($(this).val());
        selectedFloor = isNaN(floor) ? null : floor; // 更新 selectedFloor
        if (!isNaN(floor)) {
            const context = getContext();
            const chat = context.chat;
            if (floor >= 0 && floor < chat.length) {
                const previewText = chat[floor].mes.substring(0, 50) + "...";
                $floorInfoPreview.text(`楼层 ${floor}: ${previewText}`);
                fullMessageText = chat[floor].mes; // 获取完整消息文本
            } else {
                $floorInfoPreview.text("楼层不存在");
                fullMessageText = "";
            }
            $fullMessageContainer.hide(); // 隐藏完整消息容器，直到点击预览
        } else {
            $floorInfoPreview.text("");
            fullMessageText = "";
            $fullMessageContainer.hide();
        }
    });

    $floorInfoPreview.on("click", function() {
        if (selectedFloor !== null && fullMessageText) {
            $fullMessageText.text(fullMessageText); // 设置完整消息文本
            $fullMessageContainer.slideDown();      // 显示完整消息容器，使用动画效果
        }
    });

    $jumpOkButton.on("click", function() {
        if (selectedFloor !== null) {
            scrollToMessage(selectedFloor);
            popup.close();
        }
    });

    $jumpButton.on("click", function() {
        if (selectedFloor !== null) {
            scrollToMessage(selectedFloor); // 点击跳转按钮也执行跳转
        }
    });
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
                scrollToMessage($(this).data("mesid"));
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
        const keyword = $("#keyword-search").val();
        handleKeywordInput(); // 触发检索
    }
}
```

**修改后的 `style.css.txt` 文件：**

```css
#message-navigator {
    position: fixed;
    left: 0;
    top: 150px;
    width: 200px;
    background-color: #f0f0f0;
    padding: 10px;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    z-index: 1000; /* 确保在其他元素之上 */
}

.keyword-search-area {
    margin-bottom: 10px;
}

.keyword-search-area input {
    width: 70%;
    margin-right: 5px;
}

.keyword-search-area button {
    margin-right: 5px;
}

.quick-scroll-area {
    margin-bottom: 10px;
}

.quick-scroll-area button {
    margin-right: 5px;
}

#search-results {
    max-height: 200px;
    overflow-y: auto;
    margin-top: 5px;
}

.search-result {
    cursor: pointer;
    padding: 5px;
    border-bottom: 1px solid #ddd;
}

.search-result:hover {
    background-color: #e0e0e0;
}

.highlight {
    background-color: yellow;
    font-weight: bold;
}

/* 新增样式用于完整消息容器 */
#full-message-container {
    background-color: #f9f9f9; /* 可选：设置容器背景色 */
}
