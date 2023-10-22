
g_border.init({
    addItem(h, method = 'appendTo'){
          $(h)[method]('#navbar-menu .navbar-nav')
    },
	init(){
		this.bar.html(`
			<header class="navbar navbar-expand-sm w-full p-0" style="height:30px;min-height: unset;">
            <div class="p-0 w-full d-flex flex-grow-1 ms-2 app-region-darg" style="height:30px">
                <h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-sm-3 ">
                    <a href=".">
                        <b id="title" class="flex-fill">Demo</b>
                    </a>
                </h1>

                <div class="navbar-nav ms-auto flex-row order-sm-last align-items-center" style="min-height: unset;">
                    <div id="traffic">
                        <div class="traffic_icons d-flex align-items-center m-0" style="font-size: 1.2rem;margin-top: 2px;">
                            <div data-action="darkMode" ><i class="ti ti-moon"></i></div>
                        </div>
                        <div class="light" style="background-color: #55efc4" data-action="min"></div>
                        <div class="light" style="background-color: #ffeaa7" data-action="max"></div>
                        <div class="light" style="background-color: #ff7675" data-action="close"></div>
                    </div>
                </div>

                <div class="collapse navbar-collapse" id="navbar-menu">
                    <div class="d-flex flex-column flex-sm-row flex-fill align-items-stretch align-items-sm-center">
                        <ul class="navbar-nav">
                            <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" data-bs-auto-close="outside" role="button" aria-expanded="false">
                                    <span class="nav-link-title">布局</span>
                                </a>
                                <div class="dropdown-menu  dropdown-menu-arrow bg-dark text-white">
                                    <a class="dropdown-item" data-action="canvas_shuffle,random">随机布局</a>
                                    <a class="dropdown-item" data-action="canvas_shuffle,waterfall">瀑布流布局</a>
                                </div>
                            </li>

                             <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" data-bs-auto-close="outside" role="button" aria-expanded="false">
                                    <span class="nav-link-title">画布</span>
                                </a>
                                <div class="dropdown-menu  dropdown-menu-arrow bg-dark text-white">
                                    <a class="dropdown-item" data-action="canvas_method,importFile">打开图片</a>
                                    <a class="dropdown-item" data-action="canvas_method,save">保存</a>
                                    <a class="dropdown-item" data-action="canvas_method,load">读取</a>
                                </div>
                            </li>
                             <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" data-bs-auto-close="outside" role="button" aria-expanded="false">
                                    <span class="nav-link-title">其他</span>
                                </a>
                                <div class="dropdown-menu  dropdown-menu-arrow bg-dark text-white">
                                    
                                    <a class="dropdown-item" data-action="modal_hotkey">快捷键</a>
                                    
                                </div>
                            </li>
                    </div>
                </div>
            </div>
        </header>
		`)

        // <a class="dropdown-item" data-action="modal_plugin">插件</a>
        // <a class="dropdown-item" data-action="settings,about">设置</a>
	}

})