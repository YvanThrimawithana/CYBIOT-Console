import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { theme } from '../styles/theme';

const NetworkMap = ({ devices }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!devices || devices.length === 0) return;
    
    drawNetworkMap();
  }, [devices]);

  const drawNetworkMap = () => {
    // Clear previous rendering
    d3.select(svgRef.current).selectAll("*").remove();

    // Get dimensions
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = 300; // Fixed height

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
    }));

    // Set up force simulation with improved spacing parameters
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150)) // Increased distance between nodes
      .force('charge', d3.forceManyBody().strength(-400)) // Stronger repulsion between nodes
      .force('center', d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force('collision', d3.forceCollide().radius(40)) // Increased collision radius
      .force('x', d3.forceX(containerWidth / 2).strength(0.05)) // Gentle force toward center x
      .force('y', d3.forceY(containerHeight / 2).strength(0.05)); // Gentle force toward center y

    // Add links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.status === 'online' ? theme.colors.status.success : '#555')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8);

    // Add breathing animation to online links
    link.filter(d => d.status === 'online')
      .append('animate')
      .attr('attributeName', 'stroke-opacity')
      .attr('values', '0.3;0.8;0.3')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    // Add nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circle for each node
    node.append('circle')
      .attr('r', d => d.id === 'hub' ? 20 : 15)
      .attr('fill', d => {
        if (d.id === 'hub') return theme.colors.primary.main;
        return d.status === 'online' ? theme.colors.status.success : '#555';
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Add pulsating animation to online nodes
    node.filter(d => d.status === 'online' && d.id !== 'hub')
      .select('circle')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '13;15;13')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    // Add labels
    node.append('text')
      .attr('dy', d => d.id === 'hub' ? -25 : 25)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.colors.text.primary)
      .style('font-size', '12px')
      .text(d => d.name);

    // Add IP address for devices (not hub)
    node.filter(d => d.id !== 'hub')
      .append('text')
      .attr('dy', 40)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.colors.text.secondary)
      .style('font-size', '10px')
      .text(d => d.id);

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
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default NetworkMap;