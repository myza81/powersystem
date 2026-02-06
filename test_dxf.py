import sys
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import os

# Create a dummy DXF if the original doesn't exist (though it should)
# But here we use the real one
file_path = '/Volumes/externalDrive/code-gym/powersystem/media/slds/ABBA132.dxf'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    sys.exit(1)

try:
    print(f"Reading {file_path}...")
    doc = ezdxf.readfile(file_path)
    msp = doc.modelspace()
    
    print("Setting up context...")
    ctx = RenderContext(doc)
    fig = plt.figure()
    ax = fig.add_axes([0, 0, 1, 1])
    out = MatplotlibBackend(ax)
    
    print("Drawing layout...")
    Frontend(ctx, out).draw_layout(msp, finalize=True)
    
    print("Saving to SVG...")
    f = io.BytesIO()
    fig.savefig(f, format='svg', transparent=True)
    plt.close(fig)
    
    content = f.getvalue().decode('utf-8')
    print(f"Success! SVG Length: {len(content)}")
except Exception as e:
    print(f"Failed: {e}")
    import traceback
    traceback.print_exc()
