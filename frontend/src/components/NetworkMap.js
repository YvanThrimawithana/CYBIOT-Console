import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { theme } from '../styles/theme';

const NetworkMap = ({ devices, expanded = false }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!devices || devices.length === 0) return;
    
    drawNetworkMap();
  }, [devices, expanded]);
  const drawNetworkMap = () => {
    // Clear previous rendering
    d3.select(svgRef.current).selectAll("*").remove();

    // Get dimensions
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = expanded ? 600 : 300; // Height adjusts based on expanded state

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    // Create central hub node (router/gateway)
    const hubNode = { 
      id: 'hub', 
      name: 'Gateway',
      status: 'online',
      fixed: true,
      x: containerWidth / 2,
      y: containerHeight / 2
    };

    // Prepare nodes (hub + devices)
    const nodes = [hubNode, ...devices.map(device => ({
      id: device.ipAddress || device.ip,
      name: device.name,
      status: (device.status || '').toLowerCase()
    }))];

    // Create links from hub to each device
    const links = devices.map(device => ({
      source: 'hub',
      target: device.ipAddress || device.ip,
      status: (device.status || '').toLowerCase()
    }));    // Set up force simulation with improved spacing parameters
    // Adjust force parameters based on expanded state
    const linkDistance = expanded ? 200 : 150;
    const chargeStrength = expanded ? -600 : -400; 
    const collisionRadius = expanded ? 60 : 40;
    
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force('collision', d3.forceCollide().radius(collisionRadius))
      .force('x', d3.forceX(containerWidth / 2).strength(0.05))
      .force('y', d3.forceY(containerHeight / 2).strength(0.05));    // Add links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.status === 'online' ? theme.colors.status.success : '#555')
      .attr('stroke-width', expanded ? 3 : 2)
      .attr('stroke-opacity', 0.8);

    // Add breathing animation to online links
    link.filter(d => d.status === 'online')
      .append('animate')
      .attr('attributeName', 'stroke-opacity')
      .attr('values', '0.3;0.8;0.3')
      .attr('dur', expanded ? '1.5s' : '2s')
      .attr('repeatCount', 'indefinite');
      
    // In expanded mode, add data flow animation for online links
    if (expanded) {
      svg.append('defs').selectAll('marker')
        .data(['online', 'offline'])
        .enter().append('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', d => d === 'online' ? 30 : 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', d => d === 'online' ? theme.colors.status.success : '#555')
        .attr('d', 'M0,-5L10,0L0,5');
        
      link.attr('marker-end', d => `url(#arrow-${d.status})`);
    }

    // Add nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));    // Add circle for each node
    node.append('circle')
      .attr('r', d => {
        if (d.id === 'hub') return expanded ? 28 : 20;
        return expanded ? 20 : 15;
      })
      .attr('fill', d => {
        if (d.id === 'hub') return theme.colors.primary.main;
        return d.status === 'online' ? theme.colors.status.success : '#555';
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', expanded ? 3 : 2);

    // Add pulsating animation to online nodes
    node.filter(d => d.status === 'online' && d.id !== 'hub')
      .select('circle')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', expanded ? '18;21;18' : '13;15;13')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');    // Add labels
    node.append('text')
      .attr('dy', d => d.id === 'hub' ? (expanded ? -35 : -25) : (expanded ? 30 : 25))
      .attr('text-anchor', 'middle')
      .attr('fill', theme.colors.text.primary)
      .style('font-size', expanded ? '14px' : '12px')
      .style('font-weight', expanded ? 'bold' : 'normal')
      .text(d => d.name);

    // Add IP address for devices (not hub)
    node.filter(d => d.id !== 'hub')
      .append('text')
      .attr('dy', expanded ? 48 : 40)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.colors.text.secondary)
      .style('font-size', expanded ? '12px' : '10px')
      .text(d => d.id);
      
    // Add status indicator text in expanded mode
    if (expanded) {
      node.filter(d => d.id !== 'hub')
        .append('text')
        .attr('dy', 65)
        .attr('text-anchor', 'middle')
        .attr('fill', d => d.status === 'online' ? theme.colors.status.success : theme.colors.status.error)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(d => d.status === 'online' ? 'ONLINE' : 'OFFLINE');
    }

    // Initial positioning - spread devices in a circle around the hub for better starting positions
    const radius = Math.min(containerWidth, containerHeight) * 0.4;
    nodes.forEach((d, i) => {
      if (d.id !== 'hub') {
        const angle = (i - 1) * (2 * Math.PI / (nodes.length - 1));
        d.x = containerWidth / 2 + radius * Math.cos(angle);
        d.y = containerHeight / 2 + radius * Math.sin(angle);
      }
    });

    // Update positions on tick
    simulation.on('tick', () => {
      // Fix hub position to center
      nodes[0].x = containerWidth / 2;
      nodes[0].y = containerHeight / 2;
      
      // Apply link positions
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      // Apply node positions with boundary constraints to keep nodes within view
      node
        .attr('transform', d => {
          d.x = Math.max(30, Math.min(containerWidth - 30, d.x));
          d.y = Math.max(30, Math.min(containerHeight - 30, d.y));
          return `translate(${d.x},${d.y})`;
        });
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      if (d.id !== 'hub') {
        d.fx = null;
        d.fy = null;
      }
    }
  };
  return (
    <div className="w-full h-full overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" 
        style={{ minHeight: expanded ? '600px' : '300px' }}>
      </svg>
    </div>
  );
};

export default NetworkMap;