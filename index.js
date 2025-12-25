const extensionName = 'cozy-cat-for-ST';
const authorConfig = {
  name: 'Mors',
  avatarUrl: '',
};
function loadSettings() {
  $('.cozy-cat-settings').remove();

  const settingsHtml = `
        <div class="cozy-cat-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Cozy Cat for ST</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>

                <div class="inline-drawer-content">
                    <div class="styled_description_block">
                        
                        <small>Created by <a href="https://bio.site/deMors" target="_blank" rel="noopener noreferrer">Mors</a> with help of POPKO<br>Hopefully, hopefully, you guys enjoy it.</small>
                    </div>
                    <hr>
                    <div style="text-align: center; color: #aaa; padding: 20px;">
                        (พื้นที่ว่าง)
                    </div>

                </div>
            </div>
        </div>
    `;

  $('#extensions_settings').append(settingsHtml);
}

jQuery(async () => {
  loadSettings();
  console.log(`[${extensionName}] Panel Loaded.`);
});