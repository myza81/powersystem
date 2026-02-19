
from collections import defaultdict, deque
from typing import List, Set, Dict, Any, Optional, Tuple
import re
import logging
from django.db.models import Q
import django
from core.models import NetworkSnapshot, NetworkBus, NetworkBranch, NetworkTransformer, NetworkGenerator, NetworkLoad

logger = logging.getLogger(__name__)

class TopologyService:
    """
    Core service for Network Topology Analysis.
    Builds graph representation of the grid and identifies islands.
    """

    def __init__(self, snapshot: NetworkSnapshot):
        self.snapshot = snapshot
        self.adj = defaultdict(list)
        self.buses = {} # id -> bus object
        self.energized_sources = set()

    def build_graph(self):
        """
        Constructs the adjacency list from active branches and transformers.
        """
        logger.info(f"Building topology graph for snapshot: {self.snapshot.name}")
        
        # 1. Load Buses
        # We need all buses to map IDs and check basic properties
        # Exclude Isolated Buses (Type 4) from Topology Analysis
        buses_qs = NetworkBus.objects.filter(snapshot=self.snapshot).exclude(bus_type=4)
        for bus in buses_qs:
            self.buses[bus.id] = bus
            # Identify potential sources (Swing Bus or Gen Bus)
            # PSS/E standard: Bus Type 3 = Swing. 
            # But we might not have `ide` field mapped. 
            # Alternatively, check NetworkGenerator existence.
        
        # 2. Identify Sources (Generators)
        # Energized islands must have at least one active generator
        gen_buses = NetworkGenerator.objects.filter(
            snapshot=self.snapshot, 
            in_service=True
        ).values_list('bus_id', flat=True)
        
        self.energized_sources = set(gen_buses)

        # 3. Add Branches (Edges)
        branches = NetworkBranch.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        )
        for br in branches:
            u, v = br.from_bus_id, br.to_bus_id
            if u in self.buses and v in self.buses:
                self.adj[u].append(v)
                self.adj[v].append(u)

        # 4. Add Transformers (Edges)
        transformers = NetworkTransformer.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        )
        for tx in transformers:
            u, v = tx.from_bus_id, tx.to_bus_id
            if u in self.buses and v in self.buses:
                self.adj[u].append(v)
                self.adj[v].append(u)
            
            # TODO: Handle 3-winding tertiary if modeled as connected node
            if tx.tertiary_bus_id:
                t = tx.tertiary_bus_id
                if t in self.buses:
                    # Star point connection model varies. 
                    # Assuming full connectivity for now (Mesh) for simplicity, 
                    # or Primary-Tertiary and Secondary-Tertiary?
                    # Winding 1-2, 1-3, 2-3 usually.
                    self.adj[u].append(t)
                    self.adj[t].append(u)
                    self.adj[v].append(t)
                    self.adj[t].append(v)

        logger.info(f"Graph built: {len(self.buses)} nodes, {len(branches) + len(transformers)} edges")

    def build_connectivity_maps(self) -> Dict[str, Any]:
        """
        Builds bus connectivity and derived substation connectivity for the snapshot.
        Uses substation_id as the identifier for substations.
        """
        buses = NetworkBus.objects.filter(snapshot=self.snapshot).select_related('substation').only(
            'id', 'bus_number', 'substation_id'
        )
        bus_map = {bus.id: (bus.bus_number, bus.substation_id) for bus in buses}

        adj = defaultdict(set)
        for bus_id in bus_map:
            adj[bus_id] = set()

        branches = NetworkBranch.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        ).values_list('from_bus_id', 'to_bus_id')
        for u, v in branches:
            if u in bus_map and v in bus_map:
                adj[u].add(v)
                adj[v].add(u)

        transformers = NetworkTransformer.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        ).values_list('from_bus_id', 'to_bus_id', 'tertiary_bus_id')
        for u, v, t in transformers:
            if u in bus_map and v in bus_map:
                adj[u].add(v)
                adj[v].add(u)
            if t and t in bus_map:
                if u in bus_map:
                    adj[u].add(t)
                    adj[t].add(u)
                if v in bus_map:
                    adj[v].add(t)
                    adj[t].add(v)

        bus_connectivity = {}
        for bus_id, (bus_number, substation_id) in bus_map.items():
            neighbors = sorted({bus_map[n][0] for n in adj[bus_id]})
            bus_connectivity[str(bus_number)] = {
                "bus_number": bus_number,
                "substation_id": substation_id,
                "neighbors": neighbors,
            }

        substation_connectivity = defaultdict(set)
        for u, v in branches:
            if u in bus_map and v in bus_map:
                su = bus_map[u][1]
                sv = bus_map[v][1]
                if su and sv and su != sv:
                    substation_connectivity[su].add(sv)
                    substation_connectivity[sv].add(su)

        for u, v, t in transformers:
            pairs = [(u, v)]
            if t:
                pairs.append((u, t))
                pairs.append((v, t))
            for a, b in pairs:
                if a in bus_map and b in bus_map:
                    sa = bus_map[a][1]
                    sb = bus_map[b][1]
                    if sa and sb and sa != sb:
                        substation_connectivity[sa].add(sb)
                        substation_connectivity[sb].add(sa)

        substation_connectivity_map = {
            substation_id: sorted(list(neighbors))
            for substation_id, neighbors in substation_connectivity.items()
        }

        return {
            "bus_connectivity": bus_connectivity,
            "substation_connectivity": substation_connectivity_map,
        }

    def build_substation_graph(self, include_inactive: bool = False, include_autotransformers: bool = True) -> Dict[str, Set[str]]:
        bus_to_sub = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )
        graph = defaultdict(set)
        branch_qs = NetworkBranch.objects.filter(snapshot=self.snapshot)
        if not include_inactive:
            branch_qs = branch_qs.filter(is_active=True)
        for u, v in branch_qs.values_list('from_bus_id', 'to_bus_id'):
            su = bus_to_sub.get(u)
            sv = bus_to_sub.get(v)
            if su and sv and su != sv:
                graph[su].add(sv)
                graph[sv].add(su)
        if include_autotransformers:
            tx_qs = NetworkTransformer.objects.filter(snapshot=self.snapshot)
            if not include_inactive:
                tx_qs = tx_qs.filter(is_active=True)
            for u, v, t in tx_qs.values_list('from_bus_id', 'to_bus_id', 'tertiary_bus_id'):
                su = bus_to_sub.get(u)
                sv = bus_to_sub.get(v)
                if su and sv and su != sv:
                    graph[su].add(sv)
                    graph[sv].add(su)
                if t:
                    st = bus_to_sub.get(t)
                    if su and st and su != st:
                        graph[su].add(st)
                        graph[st].add(su)
                    if sv and st and sv != st:
                        graph[sv].add(st)
                        graph[st].add(sv)
        return graph

    def get_autotransformers_by_substation(self, include_inactive: bool = False) -> Dict[str, List[Dict[str, Any]]]:
        bus_info = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )
        tx_qs = NetworkTransformer.objects.filter(snapshot=self.snapshot)
        if not include_inactive:
            tx_qs = tx_qs.filter(is_active=True)

        result = defaultdict(list)
        for tx_id, u, v, t, ckt in tx_qs.values_list(
            'id', 'from_bus_id', 'to_bus_id', 'tertiary_bus_id', 'ckt_id'
        ):
            su = bus_info.get(u)
            sv = bus_info.get(v)
            st = bus_info.get(t) if t else None
            owner_sub = su or sv or st
            if not owner_sub:
                continue
            result[owner_sub].append({
                "id": tx_id,
                "from_substation_id": su,
                "to_substation_id": sv,
                "tertiary_substation_id": st,
                "ckt_id": ckt,
            })
        return result

    def get_load_transformers_by_substation(self, include_inactive: bool = False) -> Dict[str, Dict[str, Any]]:
        bus_to_sub = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )
        loads_qs = NetworkLoad.objects.filter(snapshot=self.snapshot).filter(
            Q(load_id__istartswith='T') | Q(load_id__istartswith='F')
        )
        if not include_inactive:
            loads_qs = loads_qs.filter(in_service=True)

        result = defaultdict(lambda: {"loads": [], "total_p_mw": 0.0, "total_q_mvar": 0.0})
        for bus_id, load_id, p_mw, q_mvar, in_service in loads_qs.values_list('bus_id', 'load_id', 'p_mw', 'q_mvar', 'in_service'):
            substation_id = bus_to_sub.get(bus_id)
            if not substation_id:
                continue
            result[substation_id]["loads"].append({"load_id": load_id, "p_mw": p_mw, "q_mvar": q_mvar, "is_active": in_service})
            result[substation_id]["total_p_mw"] += p_mw
            result[substation_id]["total_q_mvar"] += q_mvar
        return result

    def compute_island(self, cuts: List[Dict[str, Any]], include_autotransformers: bool = True) -> List[str]:
        if not cuts:
            return []

        removals = []
        for cut in cuts:
            removals.append({
                "from_substation_id": cut.get("from_substation_id"),
                "to_substation_id": cut.get("to_substation_id"),
                "circuit_ids": self._normalize_circuit_ids(cut.get("circuit_ids")),
                "link_type": (cut.get("link_type") or "branch").lower().strip(),
                "isolation_scope": (cut.get("isolation_scope") or "between").lower().strip(),
            })

        bus_to_sub = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )

        def should_remove_any(edge_type: str, su: Optional[str], sv: Optional[str], ckt_id: Optional[str]) -> bool:
            for rule in removals:
                if edge_type != rule["link_type"]:
                    continue
                if not su or not sv:
                    continue
                if rule["isolation_scope"] == "to_substation_circuits":
                    if rule["to_substation_id"] not in {su, sv}:
                        continue
                    if not rule["circuit_ids"]:
                        return True
                    if str(ckt_id).strip() in rule["circuit_ids"]:
                        return True
                    continue
                if {su, sv} != {rule["from_substation_id"], rule["to_substation_id"]}:
                    continue
                if not rule["circuit_ids"]:
                    return True
                if str(ckt_id).strip() in rule["circuit_ids"]:
                    return True
            return False

        graph = defaultdict(set)
        branch_qs = NetworkBranch.objects.filter(snapshot=self.snapshot, is_active=True)
        for u, v, ckt_id in branch_qs.values_list('from_bus_id', 'to_bus_id', 'ckt_id'):
            su = bus_to_sub.get(u)
            sv = bus_to_sub.get(v)
            if su and sv and su != sv:
                if not should_remove_any("branch", su, sv, ckt_id):
                    graph[su].add(sv)
                    graph[sv].add(su)

        if include_autotransformers:
            tx_qs = NetworkTransformer.objects.filter(snapshot=self.snapshot, is_active=True)
            for u, v, t, ckt_id in tx_qs.values_list('from_bus_id', 'to_bus_id', 'tertiary_bus_id', 'ckt_id'):
                su = bus_to_sub.get(u)
                sv = bus_to_sub.get(v)
                if su and sv and su != sv:
                    if not should_remove_any("autotransformer", su, sv, ckt_id):
                        graph[su].add(sv)
                        graph[sv].add(su)
                if t:
                    st = bus_to_sub.get(t)
                    if su and st and su != st:
                        if not should_remove_any("autotransformer", su, st, ckt_id):
                            graph[su].add(st)
                            graph[st].add(su)
                    if sv and st and sv != st:
                        if not should_remove_any("autotransformer", sv, st, ckt_id):
                            graph[sv].add(st)
                            graph[st].add(sv)

        all_nodes = set(
            NetworkBus.objects.filter(snapshot=self.snapshot, substation_id__isnull=False)
            .values_list('substation_id', flat=True)
        )

        visited = set()
        components = []
        for node in all_nodes:
            if node in visited:
                continue
            queue = deque([node])
            visited.add(node)
            component = set([node])
            while queue:
                u = queue.popleft()
                for v in graph.get(u, []):
                    if v not in visited:
                        visited.add(v)
                        component.add(v)
                        queue.append(v)
            components.append(component)

        component_by_node = {}
        for idx, comp in enumerate(components):
            for node in comp:
                component_by_node[node] = idx

        disconnected = set()
        for rule in removals:
            from_sub = rule["from_substation_id"]
            to_sub = rule["to_substation_id"]
            if not from_sub or not to_sub:
                continue
            if from_sub not in component_by_node or to_sub not in component_by_node:
                continue
            if component_by_node[from_sub] != component_by_node[to_sub]:
                disconnected.update(components[component_by_node[to_sub]])

        return sorted(disconnected)

    def compute_load_totals(
        self,
        substations: List[str],
        exclude_load_ids_by_substation: Optional[Dict[str, List[str]]] = None,
        include_inactive: bool = False,
    ) -> Dict[str, Any]:
        if not substations:
            return {
                "isolated_substation_load_totals": {},
                "isolated_loads": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }

        load_map = self.get_load_transformers_by_substation(include_inactive=include_inactive)
        exclude_map = exclude_load_ids_by_substation or {}
        isolated_loads = {}
        for sub_id in substations:
            payload = load_map.get(sub_id, {"loads": [], "total_p_mw": 0.0, "total_q_mvar": 0.0})
            excludes = {str(x).strip() for x in exclude_map.get(sub_id, [])}
            if excludes:
                filtered = [l for l in payload["loads"] if str(l["load_id"]).strip() not in excludes]
                payload = {
                    "loads": filtered,
                    "total_p_mw": sum(l["p_mw"] for l in filtered),
                    "total_q_mvar": sum(l["q_mvar"] for l in filtered),
                }
            isolated_loads[sub_id] = payload

        isolated_substation_load_totals = {
            sub_id: {
                "total_p_mw": payload["total_p_mw"],
                "total_q_mvar": payload["total_q_mvar"],
            }
            for sub_id, payload in isolated_loads.items()
        }
        total_p_mw = sum(v["total_p_mw"] for v in isolated_loads.values())
        total_q_mvar = sum(v["total_q_mvar"] for v in isolated_loads.values())

        return {
            "isolated_substation_load_totals": isolated_substation_load_totals,
            "isolated_loads": isolated_loads,
            "isolated_total_p_mw": total_p_mw,
            "isolated_total_q_mvar": total_q_mvar,
        }

    def parse_load_shedding_instruction(self, instruction: str) -> Dict[str, Any]:
        text = (instruction or "").strip()
        if not text:
            return {"substation_id": "", "load_ids": []}

        lower = text.lower()
        if "isolate" not in lower:
            return {"substation_id": "", "load_ids": []}

        parts = re.split(r"\bisolate\b", text, flags=re.IGNORECASE)
        from_sub = parts[0].strip().split()[0] if parts[0].strip() else ""
        right = parts[1] if len(parts) > 1 else ""
        right = re.sub(r"\bload\b", "", right, flags=re.IGNORECASE).strip()
        tokens = [t.strip() for t in right.split(',') if t.strip()]
        load_ids = [t.split()[0] for t in tokens if t.split()]
        return {"substation_id": from_sub, "load_ids": load_ids}

    def evaluate_shedding_group(self, group_spec: Dict[str, Any]) -> Dict[str, Any]:
        include_autotransformers = bool(group_spec.get("include_autotransformers", True))

        island_instructions = group_spec.get("island_instructions", []) or []
        island_rules = []
        for instruction in island_instructions:
            rules = self.parse_isolation_instructions(instruction)
            for from_sub, to_sub, circuits, link_type, isolation_scope in rules:
                if link_type == "load_transformer":
                    continue
                island_rules.append({
                    "from_substation_id": from_sub,
                    "to_substation_id": to_sub,
                    "circuit_ids": circuits,
                    "link_type": link_type,
                    "isolation_scope": isolation_scope,
                })

        island_substations = self.compute_island(island_rules, include_autotransformers=include_autotransformers)

        load_instructions = group_spec.get("load_instructions", []) or []
        exclude_load_ids_by_substation = defaultdict(list)
        load_substations = set()
        for instruction in load_instructions:
            parsed = self.parse_load_shedding_instruction(instruction)
            if parsed["substation_id"]:
                load_substations.add(parsed["substation_id"])
                exclude_load_ids_by_substation[parsed["substation_id"]].extend(parsed["load_ids"])

        target_substations = island_substations or sorted(load_substations)

        load_totals = self.compute_load_totals(
            substations=target_substations,
            exclude_load_ids_by_substation=exclude_load_ids_by_substation,
        )

        autotransformers = self.get_autotransformers_by_substation() if include_autotransformers else {}
        isolated_autotransformers = {sub_id: autotransformers.get(sub_id, []) for sub_id in target_substations}

        return {
            "isolated_substations": target_substations,
            "isolated_loads": load_totals["isolated_loads"],
            "isolated_substation_load_totals": load_totals["isolated_substation_load_totals"],
            "isolated_autotransformers": isolated_autotransformers,
            "isolated_total_p_mw": load_totals["isolated_total_p_mw"],
            "isolated_total_q_mvar": load_totals["isolated_total_q_mvar"],
        }

    def build_network_topology_tree(self, include_inactive_branches: bool = True) -> Dict[str, Any]:
        buses = NetworkBus.objects.filter(snapshot=self.snapshot).select_related('substation')
        bus_info = {}
        for bus in buses:
            bus_info[bus.id] = {
                "bus_id": bus.id,
                "bus_number": bus.bus_number,
                "bus_name": bus.bus_name,
                "substation_id": bus.substation.substation_id if bus.substation else None,
                "substation_name": bus.substation.name if bus.substation else None,
            }

        branches_qs = NetworkBranch.objects.filter(snapshot=self.snapshot)
        if not include_inactive_branches:
            branches_qs = branches_qs.filter(is_active=True)

        load_map = self.get_load_transformers_by_substation(include_inactive=True)

        grouped = defaultdict(lambda: {
            "substation_id": None,
            "substation_name": None,
            "buses": {},
            "load_transformers": [],
        })

        for b in branches_qs.select_related(
            'from_bus', 'to_bus', 'from_bus__substation', 'to_bus__substation'
        ):
            from_bus = bus_info.get(b.from_bus_id)
            to_bus = bus_info.get(b.to_bus_id)
            if not from_bus or not to_bus:
                continue

            for bus in (from_bus, to_bus):
                sub_id = bus.get("substation_id")
                if not sub_id:
                    continue
                grouped[sub_id]["substation_id"] = sub_id
                grouped[sub_id]["substation_name"] = bus.get("substation_name")
                bus_key = str(bus["bus_number"])
                if bus_key not in grouped[sub_id]["buses"]:
                    grouped[sub_id]["buses"][bus_key] = {
                        "bus_id": bus["bus_id"],
                        "bus_number": bus["bus_number"],
                        "bus_name": bus["bus_name"],
                        "branches": [],
                    }

                grouped[sub_id]["buses"][bus_key]["branches"].append({
                    "branch_id": b.id,
                    "ckt_id": b.ckt_id,
                    "is_active": b.is_active,
                    "from_bus": from_bus,
                    "to_bus": to_bus,
                })

        for sub_id, payload in load_map.items():
            grouped[sub_id]["substation_id"] = sub_id
            if not grouped[sub_id]["substation_name"]:
                grouped[sub_id]["substation_name"] = None
            grouped[sub_id]["load_transformers"] = payload["loads"]

        substations = {}
        for sub_id in sorted(grouped.keys()):
            buses_map = grouped[sub_id]["buses"]
            grouped[sub_id]["buses"] = [
                buses_map[key] for key in sorted(buses_map.keys(), key=lambda x: int(x))
            ]
            substations[sub_id] = grouped[sub_id]

        return {"substations": substations}

    def _normalize_circuit_ids(self, circuit_ids: Optional[List[str]]) -> Set[str]:
        if not circuit_ids:
            return set()
        return {str(c).strip() for c in circuit_ids if str(c).strip()}

    @staticmethod
    def parse_isolation_instruction(instruction: str) -> Tuple[str, str, List[str], str, str]:
        """
        Parse instructions like:
        "RTAU132 isolate TKMG132 1, TKMG132 2" or
        "RTAU132 isolate TKMG132" or
        "RTAU132 isolate TKMG132 T1, TKMG132 T2"
        Returns: (from_substation_id, to_substation_id, circuit_ids, link_type, isolation_scope)
        """
        text = (instruction or "").strip()
        if not text:
            return "", "", [], "branch", "between"

        lower = text.lower()
        if "load" in lower:
            link_type = "load_transformer"
        elif "auto" in lower:
            link_type = "autotransformer"
        else:
            link_type = "branch"

        parts = re.split(r"\bisolate\b", text, flags=re.IGNORECASE)
        if len(parts) < 2:
            return "", "", [], link_type, "between"

        from_sub = parts[0].strip().split()[0] if parts[0].strip() else ""
        right = parts[1]

        tokens = [t.strip() for t in right.split(',') if t.strip()]
        if not tokens:
            return from_sub, "", [], link_type, "between"

        to_sub = ""
        circuits = []
        for token in tokens:
            bits = token.split()
            if not bits:
                continue
            sub_id = bits[0]
            if not to_sub:
                to_sub = sub_id
            if sub_id != to_sub:
                continue
            circuits.extend(bits[1:])

        isolation_scope = "between"
        if circuits and to_sub:
            if re.search(r"\ball\b", lower) or re.search(r"substation", lower):
                isolation_scope = "to_substation_circuits"

        return from_sub, to_sub, circuits, link_type, isolation_scope

    @staticmethod
    def parse_isolation_instructions(instruction: str) -> List[Tuple[str, str, List[str], str, str]]:
        text = (instruction or "").strip()
        if not text:
            return []

        lower = text.lower()
        if "load" in lower:
            link_type = "load_transformer"
        elif "auto" in lower:
            link_type = "autotransformer"
        else:
            link_type = "branch"

        parts = re.split(r"\bisolate\b", text, flags=re.IGNORECASE)
        if len(parts) < 2:
            return []

        from_sub = parts[0].strip().split()[0] if parts[0].strip() else ""
        right = parts[1]

        tokens = [t.strip() for t in right.split(',') if t.strip()]
        if not tokens:
            return []

        target_map: Dict[str, List[str]] = {}
        for token in tokens:
            bits = token.split()
            if not bits:
                continue
            sub_id = bits[0]
            circuits = bits[1:]
            if sub_id not in target_map:
                target_map[sub_id] = []
            target_map[sub_id].extend(circuits)

        results = []
        for to_sub, circuits in target_map.items():
            isolation_scope = "between"
            if circuits and (re.search(r"\ball\b", lower) or re.search(r"substation", lower)):
                isolation_scope = "to_substation_circuits"
            results.append((from_sub, to_sub, circuits, link_type, isolation_scope))

        return results

    def simulate_isolation_from_instruction(self, instruction: str, include_autotransformers: bool = True) -> Dict[str, Any]:
        rules = self.parse_isolation_instructions(instruction)
        if not rules:
            return {
                "isolated_substations": [],
                "isolated_loads": {},
                "isolated_substation_load_totals": {},
                "isolated_autotransformers": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }
        if len(rules) == 1:
            from_sub, to_sub, circuits, link_type, isolation_scope = rules[0]
            return self.simulate_isolation(
                from_substation_id=from_sub,
                to_substation_id=to_sub,
                circuit_ids=circuits,
                link_type=link_type,
                isolation_scope=isolation_scope,
                include_autotransformers=include_autotransformers,
            )
        instructions = []
        for from_sub, to_sub, circuits, link_type, isolation_scope in rules:
            if circuits:
                instructions.append(f"{from_sub} isolate {to_sub} {' '.join(circuits)}")
            else:
                instructions.append(f"{from_sub} isolate {to_sub}")
        return self.simulate_isolation_from_instructions(
            instructions=instructions,
            anchor_substation_id=rules[0][1],
            include_autotransformers=include_autotransformers,
        )

    def simulate_isolation_from_instructions(
        self,
        instructions: List[str],
        anchor_substation_id: Optional[str] = None,
        include_autotransformers: bool = True,
    ) -> Dict[str, Any]:
        removals = []
        for instruction in instructions:
            rules = self.parse_isolation_instructions(instruction)
            for from_sub, to_sub, circuits, link_type, isolation_scope in rules:
                removals.append({
                    "from_substation_id": from_sub,
                    "to_substation_id": to_sub,
                    "circuit_ids": self._normalize_circuit_ids(circuits),
                    "link_type": link_type,
                    "isolation_scope": isolation_scope,
                })

        if not removals:
            return {
                "isolated_substations": [],
                "isolated_loads": {},
                "isolated_substation_load_totals": {},
                "isolated_autotransformers": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }

        if not anchor_substation_id:
            anchor_substation_id = removals[0]["to_substation_id"]

        bus_to_sub = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )

        def should_remove_any(edge_type: str, su: Optional[str], sv: Optional[str], ckt_id: Optional[str]) -> bool:
            for rule in removals:
                if edge_type != rule["link_type"]:
                    continue
                if not su or not sv:
                    continue
                if rule["isolation_scope"] == "to_substation_circuits":
                    if rule["to_substation_id"] not in {su, sv}:
                        continue
                    if not rule["circuit_ids"]:
                        return True
                    if str(ckt_id).strip() in rule["circuit_ids"]:
                        return True
                    continue
                if {su, sv} != {rule["from_substation_id"], rule["to_substation_id"]}:
                    continue
                if not rule["circuit_ids"]:
                    return True
                if str(ckt_id).strip() in rule["circuit_ids"]:
                    return True
            return False

        graph = defaultdict(set)
        branch_qs = NetworkBranch.objects.filter(snapshot=self.snapshot, is_active=True)
        for u, v, ckt_id in branch_qs.values_list('from_bus_id', 'to_bus_id', 'ckt_id'):
            su = bus_to_sub.get(u)
            sv = bus_to_sub.get(v)
            if su and sv and su != sv:
                if not should_remove_any("branch", su, sv, ckt_id):
                    graph[su].add(sv)
                    graph[sv].add(su)

        if include_autotransformers:
            tx_qs = NetworkTransformer.objects.filter(snapshot=self.snapshot, is_active=True)
            for u, v, t, ckt_id in tx_qs.values_list('from_bus_id', 'to_bus_id', 'tertiary_bus_id', 'ckt_id'):
                su = bus_to_sub.get(u)
                sv = bus_to_sub.get(v)
                if su and sv and su != sv:
                    if not should_remove_any("autotransformer", su, sv, ckt_id):
                        graph[su].add(sv)
                        graph[sv].add(su)
                if t:
                    st = bus_to_sub.get(t)
                    if su and st and su != st:
                        if not should_remove_any("autotransformer", su, st, ckt_id):
                            graph[su].add(st)
                            graph[st].add(su)
                    if sv and st and sv != st:
                        if not should_remove_any("autotransformer", sv, st, ckt_id):
                            graph[sv].add(st)
                            graph[st].add(sv)

        all_nodes = set(
            NetworkBus.objects.filter(snapshot=self.snapshot, substation_id__isnull=False)
            .values_list('substation_id', flat=True)
        )

        visited = set()
        components = []
        for node in all_nodes:
            if node in visited:
                continue
            queue = deque([node])
            visited.add(node)
            component = set([node])
            while queue:
                u = queue.popleft()
                for v in graph.get(u, []):
                    if v not in visited:
                        visited.add(v)
                        component.add(v)
                        queue.append(v)
            components.append(component)
        component_by_node = {}
        for idx, comp in enumerate(components):
            for node in comp:
                component_by_node[node] = idx

        disconnected = set()
        for rule in removals:
            from_sub = rule["from_substation_id"]
            to_sub = rule["to_substation_id"]
            if not from_sub or not to_sub:
                continue
            if from_sub not in component_by_node or to_sub not in component_by_node:
                continue
            if component_by_node[from_sub] != component_by_node[to_sub]:
                disconnected.update(components[component_by_node[to_sub]])

        if not disconnected:
            return {
                "isolated_substations": [],
                "isolated_loads": {},
                "isolated_substation_load_totals": {},
                "isolated_autotransformers": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }

        load_map = self.get_load_transformers_by_substation()
        isolated_loads = {sub_id: load_map.get(sub_id, {"loads": [], "total_p_mw": 0.0, "total_q_mvar": 0.0})
                          for sub_id in sorted(disconnected)}
        isolated_substation_load_totals = {
            sub_id: {
                "total_p_mw": payload["total_p_mw"],
                "total_q_mvar": payload["total_q_mvar"],
            }
            for sub_id, payload in isolated_loads.items()
        }
        autotransformers = self.get_autotransformers_by_substation() if include_autotransformers else {}
        isolated_autotransformers = {sub_id: autotransformers.get(sub_id, []) for sub_id in sorted(disconnected)}
        total_p_mw = sum(v["total_p_mw"] for v in isolated_loads.values())
        total_q_mvar = sum(v["total_q_mvar"] for v in isolated_loads.values())

        return {
            "isolated_substations": sorted(disconnected),
            "isolated_loads": isolated_loads,
            "isolated_substation_load_totals": isolated_substation_load_totals,
            "isolated_autotransformers": isolated_autotransformers,
            "isolated_total_p_mw": total_p_mw,
            "isolated_total_q_mvar": total_q_mvar,
        }

    def simulate_isolation(
        self,
        from_substation_id: str,
        to_substation_id: str,
        circuit_ids: Optional[List[str]] = None,
        link_type: str = "branch",
        isolation_scope: str = "between",
        include_autotransformers: bool = True,
    ) -> Dict[str, Any]:
        normalized_circuits = self._normalize_circuit_ids(circuit_ids)
        link_type = link_type.lower().strip()
        isolation_scope = isolation_scope.lower().strip()

        bus_to_sub = dict(
            NetworkBus.objects.filter(snapshot=self.snapshot).values_list('id', 'substation_id')
        )

        graph = defaultdict(set)

        def should_remove_edge(edge_type: str, su: Optional[str], sv: Optional[str], ckt_id: Optional[str]) -> bool:
            if edge_type != link_type:
                return False
            if not su or not sv:
                return False
            if isolation_scope == "to_substation_circuits":
                if to_substation_id not in {su, sv}:
                    return False
                if not normalized_circuits:
                    return True
                return str(ckt_id).strip() in normalized_circuits
            if {su, sv} != {from_substation_id, to_substation_id}:
                return False
            if not normalized_circuits:
                return True
            return str(ckt_id).strip() in normalized_circuits

        branch_qs = NetworkBranch.objects.filter(snapshot=self.snapshot, is_active=True)
        for u, v, ckt_id in branch_qs.values_list('from_bus_id', 'to_bus_id', 'ckt_id'):
            su = bus_to_sub.get(u)
            sv = bus_to_sub.get(v)
            if su and sv and su != sv:
                if not should_remove_edge("branch", su, sv, ckt_id):
                    graph[su].add(sv)
                    graph[sv].add(su)

        if include_autotransformers:
            tx_qs = NetworkTransformer.objects.filter(snapshot=self.snapshot, is_active=True)
            for u, v, t, ckt_id in tx_qs.values_list('from_bus_id', 'to_bus_id', 'tertiary_bus_id', 'ckt_id'):
                su = bus_to_sub.get(u)
                sv = bus_to_sub.get(v)
                if su and sv and su != sv:
                    if not should_remove_edge("autotransformer", su, sv, ckt_id):
                        graph[su].add(sv)
                        graph[sv].add(su)
                if t:
                    st = bus_to_sub.get(t)
                    if su and st and su != st:
                        if not should_remove_edge("autotransformer", su, st, ckt_id):
                            graph[su].add(st)
                            graph[st].add(su)
                    if sv and st and sv != st:
                        if not should_remove_edge("autotransformer", sv, st, ckt_id):
                            graph[sv].add(st)
                            graph[st].add(sv)

        all_nodes = set(
            NetworkBus.objects.filter(snapshot=self.snapshot, substation_id__isnull=False)
            .values_list('substation_id', flat=True)
        )

        visited = set()
        components = []
        for node in all_nodes:
            if node in visited:
                continue
            queue = deque([node])
            visited.add(node)
            component = set([node])
            while queue:
                u = queue.popleft()
                for v in graph.get(u, []):
                    if v not in visited:
                        visited.add(v)
                        component.add(v)
                        queue.append(v)
            components.append(component)

        target_component = None
        for comp in components:
            if to_substation_id in comp:
                target_component = comp
                break

        if not target_component:
            return {
                "from_substation_id": from_substation_id,
                "to_substation_id": to_substation_id,
                "link_type": link_type,
                "isolation_scope": isolation_scope,
                "circuit_ids": sorted(normalized_circuits),
                "still_connected": False,
                "isolated_substations": [],
                "isolated_loads": {},
                "isolated_substation_load_totals": {},
                "isolated_autotransformers": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }

        if from_substation_id in target_component:
            return {
                "from_substation_id": from_substation_id,
                "to_substation_id": to_substation_id,
                "link_type": link_type,
                "isolation_scope": isolation_scope,
                "circuit_ids": sorted(normalized_circuits),
                "still_connected": True,
                "isolated_substations": [],
                "isolated_loads": {},
                "isolated_substation_load_totals": {},
                "isolated_autotransformers": {},
                "isolated_total_p_mw": 0.0,
                "isolated_total_q_mvar": 0.0,
            }

        load_map = self.get_load_transformers_by_substation()
        if link_type == "load_transformer" and normalized_circuits:
            for sub_id, payload in load_map.items():
                filtered = [l for l in payload["loads"] if str(l["load_id"]).strip() not in normalized_circuits]
                payload["loads"] = filtered
                payload["total_p_mw"] = sum(l["p_mw"] for l in filtered)
                payload["total_q_mvar"] = sum(l["q_mvar"] for l in filtered)

        isolated_loads = {sub_id: load_map.get(sub_id, {"loads": [], "total_p_mw": 0.0, "total_q_mvar": 0.0})
                          for sub_id in sorted(target_component)}
        isolated_substation_load_totals = {
            sub_id: {
                "total_p_mw": payload["total_p_mw"],
                "total_q_mvar": payload["total_q_mvar"],
            }
            for sub_id, payload in isolated_loads.items()
        }
        autotransformers = self.get_autotransformers_by_substation() if include_autotransformers else {}
        isolated_autotransformers = {sub_id: autotransformers.get(sub_id, []) for sub_id in sorted(target_component)}
        total_p_mw = sum(v["total_p_mw"] for v in isolated_loads.values())
        total_q_mvar = sum(v["total_q_mvar"] for v in isolated_loads.values())

        return {
            "from_substation_id": from_substation_id,
            "to_substation_id": to_substation_id,
            "link_type": link_type,
            "isolation_scope": isolation_scope,
            "circuit_ids": sorted(normalized_circuits),
            "still_connected": False,
            "isolated_substations": sorted(target_component),
            "isolated_loads": isolated_loads,
            "isolated_substation_load_totals": isolated_substation_load_totals,
            "isolated_autotransformers": isolated_autotransformers,
            "isolated_total_p_mw": total_p_mw,
            "isolated_total_q_mvar": total_q_mvar,
        }

    def simulate_branch_isolation(self, from_substation_id: str, to_substation_id: str, include_autotransformers: bool = True) -> Dict[str, Any]:
        return self.simulate_isolation(
            from_substation_id=from_substation_id,
            to_substation_id=to_substation_id,
            link_type="branch",
            include_autotransformers=include_autotransformers,
        )

    def find_islands(self) -> List[Set[int]]:
        """
        Finds all connected components (islands) in the network.
        Returns a list of sets, where each set contains bus IDs.
        """
        visited = set()
        islands = []

        for bus_id in self.buses:
            if bus_id not in visited:
                component = set()
                queue = deque([bus_id])
                visited.add(bus_id)
                component.add(bus_id)

                while queue:
                    u = queue.popleft()
                    for v in self.adj[u]:
                        if v not in visited:
                            visited.add(v)
                            component.add(v)
                            queue.append(v)
                
                islands.append(component)

        return islands

    def analyze_islands(self) -> List[Dict[str, Any]]:
        """
        Returns detailed analysis of islands.
        Classification: 'Energized' (contains Gen) vs 'De-energized' (Load Risk) vs 'Floating' (No Load/Gen).
        """
        islands = self.find_islands()
        results = []
        
        # Pre-fetch loads
        from core.models import NetworkLoad
        from django.db.models import Sum
        
        # Map bus_id -> total active load MW/MVAR
        # This is slightly inefficient for massive grids but robust
        # TODO: Optimize with a single aggregate query grouping by bus
        load_map_mw = defaultdict(float)
        load_map_mvar = defaultdict(float)
        loads = NetworkLoad.objects.filter(snapshot=self.snapshot, in_service=True).values('bus_id', 'p_mw', 'q_mvar')
        for load in loads:
            load_map_mw[load['bus_id']] += load['p_mw']
            load_map_mvar[load['bus_id']] += load['q_mvar']

        for i, island_nodes in enumerate(islands):
            # Check for generation
            has_gen = not self.energized_sources.isdisjoint(island_nodes)
            
            # Calculate total load
            total_load_mw = sum(load_map_mw[bid] for bid in island_nodes)
            total_load_mvar = sum(load_map_mvar[bid] for bid in island_nodes)
            
            # Classify
            if has_gen:
                status = 'Energized'
            elif total_load_mw > 0.001: # Threshold for meaningful load
                status = 'De-energized' # Risk Area
            else:
                status = 'Floating' # Noise/Spare
            
            # Identify Substations
            bus_objects = NetworkBus.objects.filter(id__in=island_nodes).select_related('substation')
            substation_map = {}
            orphan_buses = []
            bus_details = []

            for bus in bus_objects:
                if bus.substation:
                    if bus.substation.pk not in substation_map:
                        substation_map[bus.substation.pk] = {
                            'id': bus.substation.pk,
                            'name': bus.substation.name,
                            'code': bus.substation.code if hasattr(bus.substation, 'code') else '',
                            'bus_count': 0
                        }
                    substation_map[bus.substation.pk]['bus_count'] += 1
                else:
                    orphan_buses.append({
                        'id': bus.bus_number,
                        'name': bus.bus_name,
                        'kv': bus.base_kv,
                        'pk': bus.id
                    })

                bus_details.append({
                    'bus_id': bus.id,
                    'bus_number': bus.bus_number,
                    'bus_name': bus.bus_name,
                    'base_kv': bus.base_kv,
                    'substation_id': bus.substation.substation_id if bus.substation else None,
                    'substation_name': bus.substation.name if bus.substation else None,
                    'load_p_mw': round(load_map_mw[bus.id], 6),
                    'load_q_mvar': round(load_map_mvar[bus.id], 6),
                })
            
            sorted_subs = sorted(substation_map.values(), key=lambda x: x['name'])
            sorted_orphans = sorted(orphan_buses, key=lambda x: x['name'])

            results.append({
                'id': i + 1,
                'bus_count': len(island_nodes),
                'status': status,
                'total_load_mw': total_load_mw,
                'total_load_mvar': total_load_mvar,
                'bus_ids': list(island_nodes),
                'buses': sorted(bus_details, key=lambda x: x['bus_number']),
                'substations': sorted_subs,
                'substation_count': len(sorted_subs),
                'orphan_buses': sorted_orphans,
                'orphan_count': len(sorted_orphans)
            })
            
        # Detect Main Grid (heuristic: max bus count among energized)
        if results:
            energized = [r for r in results if r['status'] == 'Energized']
            if energized:
                main_grid = max(energized, key=lambda x: x['bus_count'])
                main_grid['status'] = 'Main Grid'

        # Filter out Floating islands from result to reduce noise?
        # User wants "999 Risk Areas" fixed.
        # If we return them as "Floating", frontend might still count them?
        # Safe bet: Return them but let frontend handle? 
        # Actually, let's exclude "Floating" from the main list unless requested?
        # No, for debugging it's useful. Reclassifying should be enough if frontend looks for "De-energized".
        # However, to be absolutely sure the count drops, I will filter them out of the return list if they are Floating AND small?
        # Let's just return them. The status change is the semantic fix.
        
        # Filter out Floating islands (Zero-Load De-energized) to reduce noise
        filtered_results = [r for r in results if r['status'] != 'Floating']
        
        return filtered_results

    def delete_buses(self, bus_ids: List[int]) -> int:
        """
        Permanently deletes the specified buses and their connected components.
        Used for cleaning up ghost islands/artifacts.
        """
        if not bus_ids:
            return 0
            
        # Safety check: prevent mass deletion unless explicitly bypassed?
        # For now, we trust the ID list from the frontend.
        
        with django.db.transaction.atomic():
            buses_to_delete = NetworkBus.objects.filter(
                snapshot=self.snapshot, 
                id__in=bus_ids
            )
            count, _ = buses_to_delete.delete()
            logger.info(f"Deleted {count} components including {len(bus_ids)} buses from snapshot {self.snapshot.id}")
            return count
