import ezdxf
import sys
import statistics

def analyze_dxf(dxf_path):
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        print(f"Error reading DXF: {e}")
        return

    entities = []
    
    print(f"Analyzing {dxf_path}...")
    
    # Collect envelopes (bounding boxes)
    for e in msp:
        try:
            # bbox: (minx, miny, minimize, maxx, maxy, maxz) usually, or (p1, p2)
            # ezdxf allows querying bounding box
            if e.dxftype() == 'LINE':
                start = e.dxf.start
                end = e.dxf.end
                bbox = (min(start.x, end.x), min(start.y, end.y), max(start.x, end.x), max(start.y, end.y))
                entities.append({'type': 'LINE', 'bbox': bbox, 'handle': e.dxf.handle, 'layer': e.dxf.layer})
            elif e.dxftype() in ['LWPOLYLINE', 'POLYLINE']:
                # Simplified bbox for polylines (points iteration)
                points = list(e.points()) if e.dxftype() == 'LWPOLYLINE' else [v.dxf.location for v in e.vertices]
                if not points: continue
                # points might be 2D or 3D tuples/vectors
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                bbox = (min(xs), min(ys), max(xs), max(ys))
                entities.append({'type': e.dxftype(), 'bbox': bbox, 'handle': e.dxf.handle, 'layer': e.dxf.layer})
            elif e.dxftype() in ['TEXT', 'MTEXT']:
                # Approximate position
                ins = e.dxf.insert
                entities.append({'type': e.dxftype(), 'bbox': (ins.x, ins.y, ins.x, ins.y), 'handle': e.dxf.handle, 'layer': e.dxf.layer, 'text': e.dxf.text if hasattr(e.dxf, 'text') else 'MTEXT'})
            # Add other types as needed
        except Exception as err:
            pass

    if not entities:
        print("No parseable entities found.")
        return

    # Calculate global extents
    min_x = min(e['bbox'][0] for e in entities)
    min_y = min(e['bbox'][1] for e in entities)
    max_x = max(e['bbox'][2] for e in entities)
    max_y = max(e['bbox'][3] for e in entities)

    width = max_x - min_x
    height = max_y - min_y
    
    print(f"Total Extents: X[{min_x:.2f}, {max_x:.2f}], Y[{min_y:.2f}, {max_y:.2f}]")
    print(f"Dimensions: {width:.2f} x {height:.2f}")

    # Calculate median center to find what's "far"
    centers_x = [(e['bbox'][0] + e['bbox'][2])/2 for e in entities]
    centers_y = [(e['bbox'][1] + e['bbox'][3])/2 for e in entities]
    
    med_x = statistics.median(centers_x)
    med_y = statistics.median(centers_y)
    
    print(f"Median Center: ({med_x:.2f}, {med_y:.2f})")
    
    # Threshold for outlier: > 2x standard deviation or just simple heuristic?
    # Let's use a simpler heuristic: if an entity is > 5000 units away from median, list it.
    # Or just list the top 5 furthest entities.
    
    entities_with_dist = []
    for e in entities:
        cx = (e['bbox'][0] + e['bbox'][2])/2
        cy = (e['bbox'][1] + e['bbox'][3])/2
        dist = ((cx - med_x)**2 + (cy - med_y)**2)**0.5
        entities_with_dist.append((dist, e))
        
    entities_with_dist.sort(key=lambda x: x[0], reverse=True)
    
    print("\nTop 5 Furthest Entities (Potential Outliers):")
    for dist, e in entities_with_dist[:5]:
        text_content = f", Text: '{e.get('text', '')}'" if 'text' in e else ""
        print(f"  Handle: {e['handle']}, Type: {e['type']}, Layer: {e['layer']}, Dist: {dist:.2f}, BBox: {e['bbox']}{text_content}")

if __name__ == "__main__":
    analyze_dxf(sys.argv[1])
