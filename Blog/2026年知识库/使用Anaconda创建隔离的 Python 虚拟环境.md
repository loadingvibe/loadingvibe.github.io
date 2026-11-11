# 1.如何使用 Anaconda 创建与管理隔离环境

Anaconda 的核心工具是 `conda`。在 Windows 的 **Anaconda Prompt**（或 macOS/Linux 的终端）中输入以下命令即可完成环境生命周期管理。

#### 1. 创建新环境

指定环境名称及 Python 基础版本：

Bash

```
conda create --name my_project_env python=3.10
```

> *注：`my_project_env` 为自定义环境名，可替换为你喜欢的名称。*

#### 2. 激活与退出环境

- **激活环境**：

  Bash

  ```
  conda activate my_project_env
  ```

  *(激活后命令行最左侧括号内的名称会由 `(base)` 变为 `(my_project_env)`)*

- **退出当前环境**（返回默认的 base 环境）：

  Bash

  ```
  conda deactivate
  ```

#### 3. 安装包

激活环境后，优先使用 `conda` 安装，如果找不到再用 `pip`：

Bash

```
# 使用 conda 安装
conda install numpy pandas

# 或者使用 pip 安装（确保当前处于目标环境中）
pip install torch torchvision
```

#### 4. 查看与删除环境

- **查看本地所有已建环境**：

  Bash

  ```
  conda env list
  # 或
  conda info --envs
  ```

- **彻底删除不需要的环境**：

  Bash

  ```
  conda env remove --name my_project_env
  ```

#### 5. 环境导出与复现（团队协作/部署迁移）

- **导出当前环境配置**：

  Bash

  ```
  conda env export > environment.yml
  ```

- **通过配置文件一键克隆环境**：

  Bash

  ```
  conda env create -f environment.yml
  ```

### ==也可以直接在软件中完成操作==

# 2. 一个代码建一个环境，还是重复使用？

**原则：按“项目/任务领域”隔离，而不是按“单个 `.py` 文件”隔离。**

#### 推荐做法：

1. **轻量学习 / 练习阶段**：
   - **复用大类通用环境**。例如只建一个名为 `dl_study` 的环境，里面装好 PyTorch、NumPy、Matplotlib，练习所有经典的深度学习入门代码（如 CNN 图像分类、RNN 文本分类等），无需每写一个脚本就新建一个环境。
2. **独立完整项目 / 复现顶会论文**：
   - **一个项目一个独立环境**。当你从 GitHub 下载别人的开源项目（如 YOLOv8、Stable Diffusion、LLaMA 微调代码）时，其依赖库版本往往极其严格（如必须依赖 `transformers==4.30.0`），此时必须为其单开环境，否则极易搞乱其他项目的正常运行。
3. **长期维护的生产项目**：
   - **独立环境**。冻结依赖包版本，保证项目无论何时何地运行都不会因为底层库自动升级而崩溃。

# 3. 深度学习与数据科学常用第三方包及用途

| **类别**                 | **库名称**                       | **核心用途与场景**                                           |
| ------------------------ | -------------------------------- | ------------------------------------------------------------ |
| **基础数值与数据处理**   | **NumPy**                        | 数组与矩阵运算的基石，提供高效的底层多维张量处理支持。       |
|                          | **Pandas**                       | 结构化表格数据处理利器（类似于代码级 Excel），用于读取 CSV/Excel、数据清洗与统计。 |
|                          | **SciPy**                        | 高级科学计算库，包含积分、优化、统计分布及信号处理函数。     |
| **数据可视化**           | **Matplotlib**                   | 最底层的绘图库，绘制折线图、直方图、散点图及训练损失（Loss）曲线。 |
|                          | **Seaborn**                      | 基于 Matplotlib 的高级统计画图库，色彩美观，一行代码出高维分布热力图。 |
| **深度学习核心框架**     | **PyTorch** (`torch`)            | 当前主流的深度学习计算图框架，负责搭建神经网络结构、GPU 自动微分与梯度更新。 |
|                          | **Torchvision**                  | PyTorch 官方视觉扩展库，内置常用图像数据集（CIFAR、ImageNet）、模型（ResNet、ViT）与图像变换函数。 |
|                          | **TensorFlow / Keras**           | Google 推出的工业级深度学习与生产部署框架。                  |
| **经典机器学习**         | **Scikit-learn** (`sklearn`)     | 传统机器学习算法集大成者（SVM、随机森林、PCA 降维、K-Means 聚类、数据划分 `train_test_split`）。 |
| **计算机视觉 (CV)**      | **OpenCV** (`opencv-python`)     | 工业级图像与视频处理工具（图片读取、裁剪、旋转、色彩空间转换、边缘检测）。 |
|                          | **Pillow** (`PIL`)               | 轻量级图像基础操作库，常用于数据加载流水线（DataLoader）中的图片预处理。 |
|                          | **Albumentations**               | 高性能数据增强库，提供极速且丰富的旋转、畸变、裁剪等几何/像素变换。 |
| **自然语言处理与大模型** | **Transformers** (`huggingface`) | 大语言模型（LLM）与预训练模型标准库，下载与微调 BERT、GPT、LLaMA、CLIP 等。 |
|                          | **Datasets / Accelerate**        | Hugging Face 提供的超大数据流式加载工具与分布式多卡快速训练加速库。 |
| **交互实验与效率工具**   | **Jupyter / ipykernel**          | 在 VS Code 或浏览器中实现按单元格（Cell）分块交互执行与即时绘图。 |
|                          | **tqdm**                         | 在 `for` 循环与训练批次（Epoch/Batch）外层套用，实时显示终端进度条与预计耗时。 |
|                          | **TensorBoard / WandB**          | 训练过程日志记录与 Web 端指标监控面板（实时观察 Loss 曲线、显存占用、预测图像）。 |

# 4. 如何在 VS Code 中配置和选择 Anaconda 创建的 Python 虚拟环境？

在 VS Code 中配置和选择 Anaconda 环境主要分为安装扩展、选择解释器、以及终端激活三步。

### 第一步：确保安装 Python 扩展

1. 打开 VS Code。
2. 点击左侧活动栏的 **扩展（Extensions）** 图标（快捷键 `Ctrl+Shift+X`，macOS 为 `Cmd+Shift+X`）。
3. 搜索并安装由 Microsoft 官方发布的 **Python** 扩展（安装后通常会自动捆绑安装 Pylance 和 Jupyter）。*验证：* 安装完成后，扩展旁边显示齿轮设置图标，状态变为“已安装（Installed）”。

### 第二步：选择并切换 Conda 环境解释器

1. 按下快捷键打开命令面板：

   - **Windows / Linux**：`Ctrl+Shift+P`
   - **macOS**：`Cmd+Shift+P`

2. 在输入框中键入并选择：

   Plaintext

   ```
   Python: Select Interpreter
   ```

3. 列表中会扫描出所有可用的 Python 环境。找到并点击带有 `conda` 标识或你所创建环境名称的项（例如 `Python 3.10.x ('dl_env': conda)`）。*验证：* 查看 VS Code 右下角状态栏，应该能看到当前已切换为该环境名（例如 `('dl_env': conda)`）；若打开 `.py` 文件，右下角会明确显示该环境。

> **如果列表中没有扫描到你的 Conda 环境：**
>
> 1. 再次打开 `Python: Select Interpreter`，选择顶部的 **Enter interpreter path...（输入解释器路径）**。
> 2. 点击 **Find...（浏览）**，手动定位到 Anaconda 环境中的 `python.exe`（macOS/Linux 为 `bin/python`）：
>    - **Windows 默认路径**：`C:\Users\<你的用户名>\anaconda3\envs\<环境名>\python.exe`
>    - **macOS/Linux 默认路径**：`~/anaconda3/envs/<环境名>/bin/python` 或 `~/miniconda3/envs/<环境名>/bin/python`

### 第三步：配置集成终端自动激活环境

1. 打开顶部菜单栏：**终端 (Terminal)** -> **新建终端 (New Terminal)**（快捷键 `Ctrl+` `）。
2. VS Code 会默认拉起命令行，并自动执行 `conda activate <环境名>`。*验证：* 终端命令行最前端出现括号包裹的环境名，例如 `(dl_env) PS C:\Users\...>`，输入 `python -V` 打印出的版本与该虚拟环境一致。

### 第四步：在 Jupyter Notebook 中绑定该环境（可选）

如果你在 VS Code 中使用 `.ipynb` 交互式文件：

1. 在终端激活目标环境，确保安装了内核支持包：

   Bash

   ```
   conda activate <你的环境名>
   pip install ipykernel
   ```

2. 打开任意 `.ipynb` 文件。

3. 点击编辑器右上角的 **选择内核 (Select Kernel)** -> **Python Environments...**。

4. 从列表中选中你的 Anaconda 虚拟环境即可。

# 方式一：直接创建/打开 `.ipynb` 文件（最推荐）

这种方式的操作逻辑与浏览器端完全一致，但自带 VS Code 的代码补全、格式化和快捷键优势。

1. **新建 Notebook 文件**：
   - 在 VS Code 中按 `Ctrl+Shift+P`（Mac 为 `Cmd+Shift+P`），输入并选择 `Create: New Jupyter Notebook`；
   - 或者直接新建一个后缀名为 `.ipynb` 的文件（例如 `demo.ipynb`）。
2. **选择运行环境（Kernel）**：
   - 点击 Notebook 编辑器右上角的 **Select Kernel（选择内核）**。
   - 选择 **Python Environments...**，在弹出列表中选中你用 Anaconda 创建的虚拟环境。
3. **交互运行**：
   - 点击代码块左侧的 **“▶”** 按钮，或者按快捷键 `Shift + Enter` 执行当前单元格并跳转到下一格。
   - 图表（如 `matplotlib` 生成的图）和数据表格（如 `pandas.DataFrame`）会直接内嵌渲染在单元格下方。

### 方式二：在普通 `.py` 脚本中使用交互式窗口（Interactive Window）

如果你习惯写标准的 `.py` 脚本，但又想随时查看某个变量或绘制某张图，无需把文件转成 `.ipynb`：

1. 在普通的 Python 代码中使用 `#%%` 作为代码块分隔符：

   Python

   ```
   #%% 第一步：导入库与生成数据
   import numpy as np
   import matplotlib.pyplot as plt
   
   x = np.linspace(0, 10, 100)
   y = np.sin(x)
   
   #%% 第二步：绘图测试
   plt.plot(x, y)
   plt.show()
   ```

2. 代码上方会自动出现 **Run Cell** 按钮。

3. 点击 **Run Cell**（或按 `Shift + Enter`），右侧会自动弹出一个类似 Jupyter 的独立交互窗口，右侧实时显示运行结果与变量状态，左侧继续保持干净的纯 Python 文件格式。

### 必备前提条件

如果在运行单元格时提示内核启动失败或缺少依赖，只需在你的 Anaconda 虚拟环境中补装 `ipykernel`：

Bash

```
conda activate <你的环境名>
pip install ipykernel
```

安装完成后，重新点击右上角指定该环境为内核即可正常交互。5. 在vscode中直接使用Jupyter Notebook 交互



#### ==使用的快捷指令==

在 VS Code 中使用 Jupyter Notebook，快捷键与原生 Jupyter 类似，主要分为命令模式（Command Mode）**与**编辑模式（Edit Mode）两种状态。

### 一、 核心模式与状态切换

- **进入命令模式**：按 `Esc`（此时单元格左侧边缘呈现选中状态，光标不闪烁）。
- **进入编辑模式**：按 `Enter`（光标在代码框内闪烁，可直接输入代码）。

### 二、 常用快捷键清单

#### 1. 运行与执行（两模式通用）

- **`Shift + Enter`**：运行当前单元格，并**选中/跳转到下一个**单元格（若下方没有则新建一个）。
- **`Ctrl + Enter`**（Mac: `Cmd + Enter`）：仅运行当前单元格，光标**停留在原地**。
- **`Alt + Enter`**（Mac: `Option + Enter`）：运行当前单元格，并在其下方**插入一个新单元格**。

#### 2. 单元格增删与移动（命令模式：按 `Esc` 后使用）

- **`A`**：在当前单元格**上方**插入新单元格（Above）。
- **`B`**：在当前单元格**下方**插入新单元格（Below）。
- **`D, D`**（连按两下 `D`）：**删除**当前单元格。
- **`Z`**：撤销上一次单元格操作（如不小心删错）。
- **`J` / `K`** 或 **`↓` / `↑`**：上下移动选中的单元格。
- **`Alt + ↑ / ↓`**（Mac: `Option + ↑ / ↓`）：将当前整个单元格**向上/向下物理拖拽移动**。

#### 3. 单元格类型切换（命令模式：按 `Esc` 后使用）

- **`M`**：将当前单元格转为 **Markdown（文档说明）** 单元格。
- **`Y`**：将当前单元格转回 **Code（代码执行）** 单元格。
- **`1` ~ `6`**：快速设置 Markdown 的 1 到 6 级标题。

#### 4. 显示与折叠控制（命令模式）

- **`L`**：切换当前单元格的**行号显示/隐藏**。
- **`Shift + L`**：为当前 Notebook 的所有单元格开启/关闭行号。
- **`O`**：折叠/展开当前单元格的输出结果。

### 三、 如何调出变量查看器（Jupyter Variable View）

变量查看器类似于 MATLAB 或 RStudio 的“工作区”，能实时列出内存中所有变量的名字、类型、大小及取值，极大方便调试数据。

#### 呼出方式：

1. **顶部工具栏一键开启**： 打开任意 `.ipynb` 文件，观察编辑器顶部的 Jupyter 工具栏（包含 `Clear All Outputs`、`Restart` 等按钮的那一行），找到并点击带有 **表格或类似 `x=` 图标的“Variables（变量）”按钮**。
2. **通过命令面板打开**：
   - 按快捷键 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）。
   - 输入并选择：`Jupyter: Focus on Variables View`。

#### 配合数据查看器（Data Viewer）深入分析：

在底部弹出的 Variables 面板中：

- 如果某个变量是 **Pandas DataFrame**、**NumPy 数组** 或 **PyTorch 张量**，变量名左侧会出现一个小网格图标（或直接双击该变量行）。
- 点击后会在新标签页以类似 Excel 的可交互表格形式展开数据，支持**列筛选、排序、按条件过滤及分页查看**，无需手动编写 `df.head()` 或循环打印。