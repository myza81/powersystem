"""
Script to create a mock DXF file for testing DXFParser.
"""

import ezdxf

def create_mock_sld_dxf(filename: str):
    # Create a new DXF document (R2010 release)
    doc = ezdxf.new('R2010')
    msp = doc.modelspace()
    
    # Add some layers
    doc.layers.new('HV_132KV', dxfattribs={'color': 3}) # Green
    doc.layers.new('EQUIPMENT', dxfattribs={'color': 7}) # White
    
    # Add Transformer T1
    msp.add_text('T1', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (100, 100),
        'height': 5
    })
    msp.add_text('30MVA', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (100, 90),
        'height': 3
    })
    msp.add_text('132/11kV', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (100, 80),
        'height': 3
    })
    
    # Add HV Breaker 110 for T1
    msp.add_text('110', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (100, 120),
        'height': 4
    })
    
    # Add a Line (conductor) near T1 with HV layer
    msp.add_line((90, 130), (110, 130), dxfattribs={'layer': 'HV_132KV'})
    
    # Add Bay SRDN1
    msp.add_text('SRDN1', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (200, 200),
        'height': 5
    })
    msp.add_text('505', dxfattribs={
        'layer': 'EQUIPMENT',
        'insert': (200, 180),
        'height': 4
    })
    
    doc.saveas(filename)
    print(f"✓ Mock DXF created: {filename}")

if __name__ == "__main__":
    create_mock_sld_dxf('media/slds/mock_abba_132.dxf')
