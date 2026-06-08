# SMB Mounter

SMB Mounter manages saved SMB shares on macOS so users can connect, disconnect, and open network storage from a small utility window.

## Language

**Share**:
A saved SMB target that the user can mount and open as network storage. In Chinese UI, prefer "共享"; use "共享配置" when clarifying that an action affects only the saved app record, not remote data.
_Avoid_: Mount configuration, network disk

**SMB Server**:
A network host that offers one or more SMB shares. In Chinese UI, use "SMB 服务器".
_Avoid_: Directory, path

**Share Discovery**:
The flow where the user finds SMB servers on the local network and selects one of the shares exposed by a server. It does not mean browsing into folders inside a share.
_Avoid_: Directory picker, remote path picker

**Mount**:
The action that makes a saved share available at its configured local path. In Chinese UI, use "挂载" and "卸载" for the primary state-changing actions.
_Avoid_: Connect, disconnect

**Local Mount Path**:
The local macOS folder path where a share becomes available after it is mounted. In Chinese UI, use "本机挂载点" when the distinction from a remote SMB share is important.
_Avoid_: Path

**Diagnostic Mode**:
A user-enabled troubleshooting mode that records local diagnostic logs for SMB share operations. In Chinese UI, use "诊断模式".
_Avoid_: Developer mode, debug mode
