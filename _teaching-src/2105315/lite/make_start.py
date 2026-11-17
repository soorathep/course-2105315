"""Write content/start.ipynb, the notebook students see first in the course JupyterLite."""
import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()
md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
nb.cells = [
    md("""# 2105315 course notebook

This notebook runs Python inside your web browser. You do not need an account, and nothing is installed on your computer.

**Step 1.** Drag your lab file from your computer onto the file list on the left. You can also click the upload button (the arrow pointing up) above the file list. Your file may open in a new tab; click the **start.ipynb** tab to come back here.

**Step 2.** Click the cell below and press **Shift+Enter**. The first run takes about 20 to 40 seconds while Python loads. Later runs are fast."""),
    code('import os\nprint(os.listdir())'),
    md("""You should see your file name in the list. If it is not there, check that the upload finished, then run the cell again.

**Step 3.** Look at the raw file before you ask the AI for code. Change `my_file.csv` to your file name, then run the cell."""),
    code('print(open("my_file.csv", encoding="utf-8").read()[:400])'),
    md("""**Step 4.** Paste the AI's code into a new cell (click **+** in the toolbar), read it, then run it.

Notes for this notebook:

- pandas, NumPy, SciPy and Matplotlib are already available. You do not need `pip install` for them.
- Your files stay in this browser on this computer. They are still here if you close the tab, but not on another computer or in another browser.
- To keep your notebook, use **File → Download**.
- If something stops responding, use **Kernel → Restart Kernel and Run All Cells**."""),
]
nb.metadata["kernelspec"] = {"name": "python", "display_name": "Python (Pyodide)", "language": "python"}
Path(__file__).with_name("content").joinpath("start.ipynb").write_text(nbf.writes(nb), encoding="utf-8")
