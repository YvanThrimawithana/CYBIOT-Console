import React from 'react';
import { 
    BarChart as RechartsBarChart,
    LineChart as RechartsLineChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { theme } from '../styles/theme';

export const BarChart = ({ data }) => {
    const chartData = Object.entries(data).map(([name, value]) => ({
        name,
        value
    }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.background.secondary} />
                <XAxis 
                    dataKey="name" 
                    stroke={theme.colors.text.secondary}
                />
                <YAxis stroke={theme.colors.text.secondary} />
                <Tooltip 
                    contentStyle={{
                        backgroundColor: theme.colors.background.card,
                        border: 'none',
                        borderRadius: '8px',
                        color: theme.colors.text.primary
                    }}
                />
                <Bar 
                    dataKey="value" 
                    fill={theme.colors.primary}
                    radius={[4, 4, 0, 0]}
                />
            </RechartsBarChart>
        </ResponsiveContainer>
    );
};

export const LineChart = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.background.card} />
                <XAxis 
                    dataKey="time" 
                    stroke={theme.colors.text.secondary}
                />
                <YAxis 
                    stroke={theme.colors.text.secondary}
                    label={{ 
                        value: 'Traffic (Mb/s)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fill: theme.colors.text.secondary }
                    }}
                />
                <Tooltip 
                    contentStyle={{
                        backgroundColor: theme.colors.background.card,
                        border: 'none',
                        borderRadius: '8px',
                        color: theme.colors.text.primary
                    }}
                />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={theme.colors.primary.main}
                    strokeWidth={2}
                    dot={false}
                />
            </RechartsLineChart>
        </ResponsiveContainer>
    );
};
